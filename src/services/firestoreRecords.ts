import { FirebaseError } from 'firebase/app';
import { Timestamp, type DocumentData } from 'firebase/firestore';
import type { ItemRecord, ItemStatus, TransactionAction, TransactionRecord } from '../types';
import { formatTime, isDateKey, toDateKey } from '../utils/dateUtils';

interface DocSnap {
  id: string;
  data(): DocumentData | undefined;
  exists(): boolean;
}

export function createDocumentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function itemDocId(barcode: string): string {
  return encodeURIComponent(barcode.trim());
}

export function isSafeDocId(id: string): boolean {
  return id.length > 0 && id.length <= 1400 && !id.includes('/');
}

export function legacyTransactionId(record: Pick<TransactionRecord, 'barcode' | 'timestamp' | 'action' | 'name'>): string {
  const raw = `${record.barcode.trim()}|${record.timestamp}|${record.action}|${record.name.trim()}`;
  const encoded = `legacy-${encodeURIComponent(raw)}`;
  if (encoded.length <= 1400) return encoded;
  return `legacy-${encodeURIComponent(raw.slice(0, 400))}-${raw.length}`;
}

export function backupTransactionId(record: TransactionRecord): string {
  if (typeof record.id === 'string' && isSafeDocId(record.id)) return record.id;
  if (record.idempotencyKey && isSafeDocId(record.idempotencyKey)) return record.idempotencyKey;
  return legacyTransactionId(record);
}

export function explainFirestoreError(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return 'You do not have permission to change these records. Sign in with a logistics account.';
    }
    if (error.code === 'unauthenticated') return 'Sign in again to use the cloud records.';
    if (error.code === 'unavailable') {
      return 'You are offline. Reconnect, then try again. A repeated save will not be duplicated.';
    }
    if (error.code === 'failed-precondition' && error.message.toLowerCase().includes('index')) {
      return 'Firestore needs the transaction date index. Deploy firestore.indexes.json, then try again.';
    }
    if (error.code === 'failed-precondition') {
      return 'You are offline. Reconnect, then submit again. This attempt will not be duplicated.';
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Could not reach Firestore.';
}

export function isMissingIndexError(error: unknown): boolean {
  return error instanceof FirebaseError
    && error.code === 'failed-precondition'
    && error.message.toLowerCase().includes('index');
}

export function timestampToIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
  return null;
}

function toTimestamp(iso: string | null | undefined): Timestamp | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
}

function asAction(value: unknown): TransactionAction | null {
  return value === 'TAKING' || value === 'RETURNING' ? value : null;
}

function asStatus(value: unknown): ItemStatus | null {
  return value === 'AVAILABLE' || value === 'TAKEN' ? value : null;
}

export function transactionFromDoc(snapshot: DocSnap): TransactionRecord | null {
  const data = snapshot.data();
  if (!snapshot.exists() || !data) return null;
  const action = asAction(data.action);
  const createdAt = timestampToIso(data.createdAt);
  if (!action || !createdAt || typeof data.barcode !== 'string' || typeof data.name !== 'string') return null;
  const transactionDate = typeof data.transactionDate === 'string' && isDateKey(data.transactionDate)
    ? data.transactionDate
    : toDateKey(createdAt);
  const transactionTime = typeof data.transactionTime === 'string' && data.transactionTime.trim()
    ? data.transactionTime
    : formatTime(createdAt);
  return {
    id: snapshot.id,
    barcode: data.barcode,
    name: data.name,
    reason: typeof data.reason === 'string' ? data.reason : '',
    action,
    timestamp: createdAt,
    transactionDate,
    transactionTime,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
    idempotencyKey: snapshot.id,
  };
}

export function itemFromDoc(snapshot: DocSnap): ItemRecord | null {
  const data = snapshot.data();
  if (!snapshot.exists() || !data) return null;
  const status = asStatus(data.status);
  if (!status || typeof data.barcode !== 'string') return null;
  return {
    barcode: data.barcode,
    status,
    currentHolder: typeof data.currentHolder === 'string' ? data.currentHolder : null,
    reason: typeof data.reason === 'string' ? data.reason : null,
    takenAt: timestampToIso(data.takenAt),
    lastUpdated: timestampToIso(data.lastUpdated) ?? new Date(0).toISOString(),
    lastTransactionDate: typeof data.lastTransactionDate === 'string' && isDateKey(data.lastTransactionDate)
      ? data.lastTransactionDate
      : null,
  };
}

export function transactionToFirestore(record: TransactionRecord, createdBy: string): DocumentData {
  const createdAt = toTimestamp(record.timestamp) ?? Timestamp.now();
  const transactionDate = record.transactionDate && isDateKey(record.transactionDate)
    ? record.transactionDate
    : toDateKey(timestampToIso(createdAt) ?? new Date().toISOString());
  return {
    barcode: record.barcode.trim(),
    name: record.name.trim(),
    reason: record.reason.trim(),
    action: record.action,
    transactionDate,
    transactionTime: record.transactionTime?.trim() || formatTime(createdAt.toDate().toISOString()),
    createdAt,
    createdBy,
  };
}

export function itemToFirestore(item: ItemRecord): DocumentData | null {
  const barcode = item.barcode.trim();
  if (!barcode) return null;
  const lastUpdated = toTimestamp(item.lastUpdated) ?? Timestamp.now();
  const lastTransactionDate = item.lastTransactionDate && isDateKey(item.lastTransactionDate)
    ? item.lastTransactionDate
    : item.takenAt
      ? toDateKey(item.takenAt)
      : null;

  if (item.status === 'TAKEN') {
    const currentHolder = item.currentHolder?.trim() ?? '';
    const reason = item.reason?.trim() ?? '';
    if (!currentHolder || !reason) return null;
    return {
      barcode,
      status: 'TAKEN',
      currentHolder,
      reason,
      takenAt: toTimestamp(item.takenAt) ?? lastUpdated,
      lastUpdated,
      lastTransactionDate,
    };
  }

  if (item.status !== 'AVAILABLE') return null;
  return {
    barcode,
    status: 'AVAILABLE',
    currentHolder: null,
    reason: null,
    takenAt: null,
    lastUpdated,
    lastTransactionDate,
  };
}
