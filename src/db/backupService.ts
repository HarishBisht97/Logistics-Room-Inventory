import { db } from './database';
import type { BackupFile, ItemRecord, TransactionAction, TransactionRecord } from '../types';
import { formatTime, isDateKey, toDateKey } from '../utils/dateUtils';

const ACTIONS = new Set<TransactionAction>(['TAKING', 'RETURNING']);

export async function getDataCounts(): Promise<{ transactions: number; items: number }> {
  const [transactions, items] = await Promise.all([
    db.transactions.count(),
    db.items.count(),
  ]);
  return { transactions, items };
}

export function parseBackup(value: unknown): BackupFile {
  if (!isRecord(value) || value.app !== 'logistics-inventory' || (value.version !== 1 && value.version !== 2)) {
    throw new Error('This file is not a logistics backup.');
  }
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error('This backup is missing an export date.');
  }
  if (!Array.isArray(value.transactions) || !Array.isArray(value.items)) {
    throw new Error('This backup is missing transactions or items.');
  }
  if (!value.transactions.every(isTransaction) || !value.items.every(isItem)) {
    throw new Error('This backup contains records this app cannot restore.');
  }

  const transactions = value.transactions.map(normalizeTransaction);
  const items = value.items.map(normalizeItem);
  const ids = new Set<string>();
  for (const transaction of transactions) {
    if (transaction.id !== undefined) {
      const key = String(transaction.id);
      if (ids.has(key)) throw new Error('This backup contains duplicate transaction ids.');
      ids.add(key);
    }
  }
  const barcodes = new Set<string>();
  for (const item of items) {
    if (barcodes.has(item.barcode)) throw new Error('This backup contains duplicate item barcodes.');
    barcodes.add(item.barcode);
  }

  return {
    app: 'logistics-inventory',
    version: value.version,
    exportedAt: value.exportedAt,
    transactions,
    items,
  };
}

export async function replaceAllData(backup: BackupFile): Promise<void> {
  let nextId = backup.transactions.reduce((max, transaction) => (
    typeof transaction.id === 'number' ? Math.max(max, transaction.id) : max
  ), 0) + 1;
  const transactions = backup.transactions.map((transaction) => {
    const id = typeof transaction.id === 'number' ? transaction.id : nextId++;
    return {
      ...transaction,
      id,
      idempotencyKey: transaction.idempotencyKey ?? (typeof transaction.id === 'string' ? transaction.id : undefined),
      transactionDate: transaction.transactionDate ?? toDateKey(transaction.timestamp),
      transactionTime: transaction.transactionTime ?? formatTime(transaction.timestamp),
    };
  });

  await db.transaction('rw', db.transactions, db.items, async () => {
    await db.transactions.clear();
    await db.items.clear();
    if (transactions.length > 0) await db.transactions.bulkAdd(transactions);
    if (backup.items.length > 0) await db.items.bulkPut(backup.items);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isTransaction(value: unknown): value is TransactionRecord {
  if (!isRecord(value)) return false;
  if (value.id !== undefined && !isId(value.id)) return false;
  if (typeof value.barcode !== 'string' || !value.barcode.trim() || value.barcode.trim().length > 128) return false;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80) return false;
  if (typeof value.reason !== 'string' || !value.reason.trim() || value.reason.trim().length > 300) return false;
  if (typeof value.action !== 'string' || !ACTIONS.has(value.action as TransactionAction)) return false;
  if (value.transactionDate !== undefined && (typeof value.transactionDate !== 'string' || !isDateKey(value.transactionDate))) return false;
  if (value.transactionTime !== undefined && (typeof value.transactionTime !== 'string' || !value.transactionTime.trim() || value.transactionTime.length > 32)) return false;
  if (value.createdBy !== undefined && value.createdBy !== null && typeof value.createdBy !== 'string') return false;
  if (value.idempotencyKey !== undefined && (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.includes('/'))) return false;
  return isIso(value.timestamp);
}

function isId(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 1;
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 1400 && !value.includes('/');
}

function isItem(value: unknown): value is ItemRecord {
  if (!isRecord(value)) return false;
  if (typeof value.barcode !== 'string' || !value.barcode.trim() || value.barcode.trim().length > 128) return false;
  if (!isIso(value.lastUpdated)) return false;
  if (value.lastTransactionDate !== undefined && value.lastTransactionDate !== null
    && (typeof value.lastTransactionDate !== 'string' || !isDateKey(value.lastTransactionDate))) return false;
  if (value.status === 'TAKEN') {
    return typeof value.currentHolder === 'string'
      && value.currentHolder.trim().length > 0
      && value.currentHolder.trim().length <= 80
      && typeof value.reason === 'string'
      && value.reason.trim().length > 0
      && value.reason.trim().length <= 300
      && isIso(value.takenAt);
  }
  return value.status === 'AVAILABLE'
    && value.currentHolder === null
    && value.reason === null
    && value.takenAt === null;
}

function normalizeTransaction(transaction: TransactionRecord): TransactionRecord {
  return {
    id: transaction.id,
    barcode: transaction.barcode.trim(),
    name: transaction.name.trim(),
    reason: transaction.reason.trim(),
    action: transaction.action,
    timestamp: transaction.timestamp,
    transactionDate: transaction.transactionDate,
    transactionTime: transaction.transactionTime,
    createdBy: typeof transaction.createdBy === 'string' ? transaction.createdBy : null,
    idempotencyKey: transaction.idempotencyKey,
  };
}

function normalizeItem(item: ItemRecord): ItemRecord {
  return {
    barcode: item.barcode.trim(),
    status: item.status,
    currentHolder: item.currentHolder?.trim() ?? null,
    reason: item.reason?.trim() ?? null,
    takenAt: item.takenAt,
    lastUpdated: item.lastUpdated,
    lastTransactionDate: item.lastTransactionDate ?? null,
  };
}
