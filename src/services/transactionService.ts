import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from '../firebase/firebase';
import {
  listTransactions as listLocalTransactions,
  listTransactionsByDate as listLocalByDate,
  listTransactionsByDateRange as listLocalByRange,
  registerTransaction,
  type NewTransaction,
} from '../db/transactionService';
import type { TransactionAction, TransactionRecord } from '../types';
import { formatTime, isDateKey, transactionDay } from '../utils/dateUtils';
import { firstError, validateTransaction } from '../utils/validation';
import {
  explainFirestoreError,
  isMissingIndexError,
  itemDocId,
  itemFromDoc,
  transactionFromDoc,
} from './firestoreRecords';

export interface TransactionDraft extends NewTransaction {
  transactionDate: string;
  idempotencyKey: string;
}

export async function addTransaction(input: TransactionDraft): Promise<void> {
  if (!isFirebaseConfigured) {
    await registerTransaction(input);
    return;
  }
  await addFirestoreTransaction(input, getFirebaseAuth().currentUser?.uid ?? null);
}

export async function getTransactionsByDate(date: string): Promise<TransactionRecord[]> {
  if (!isDateKey(date)) return [];
  if (!isFirebaseConfigured) return listLocalByDate(date);
  const rows = await readTransactions(date, date);
  return sortNewest(rows);
}

export async function getTransactionsByDateRange(start: string, end: string): Promise<TransactionRecord[]> {
  if (!isDateKey(start) || !isDateKey(end) || start > end) return [];
  if (!isFirebaseConfigured) return listLocalByRange(start, end);
  return sortNewest(await readTransactions(start, end));
}

export async function getAllTransactions(): Promise<TransactionRecord[]> {
  if (!isFirebaseConfigured) return listLocalTransactions();
  const snapshot = await getDocs(query(collection(getFirestoreDb(), 'transactions'), orderBy('createdAt', 'desc')));
  return sortNewest(snapshot.docs.flatMap((item) => {
    const record = transactionFromDoc(item);
    return record ? [record] : [];
  }));
}

export function watchTransactions(
  start: string,
  end: string,
  onData: (transactions: TransactionRecord[]) => void,
  onError: (message: string) => void,
  createdBy?: string | null,
): Unsubscribe {
  let current = () => {};
  let active = true;
  const listen = (withCreatedAt: boolean) => {
    current = onSnapshot(transactionQuery(start, end, withCreatedAt, createdBy), (snapshot) => {
      if (!active) return;
      onData(sortNewest(snapshot.docs.flatMap((item) => {
        const record = transactionFromDoc(item);
        return record ? [record] : [];
      })));
    }, (error) => {
      if (!active) return;
      if (withCreatedAt && isMissingIndexError(error)) {
        current();
        listen(false);
        return;
      }
      onError(explainFirestoreError(error));
    });
  };
  listen(true);
  return () => {
    active = false;
    current();
  };
}

async function readTransactions(start: string, end: string): Promise<TransactionRecord[]> {
  try {
    const snapshot = await getDocs(transactionQuery(start, end, true));
    return snapshot.docs.flatMap((item) => {
      const record = transactionFromDoc(item);
      return record ? [record] : [];
    });
  } catch (error) {
    if (!isMissingIndexError(error)) throw new Error(explainFirestoreError(error));
    const snapshot = await getDocs(transactionQuery(start, end, false));
    return snapshot.docs.flatMap((item) => {
      const record = transactionFromDoc(item);
      return record ? [record] : [];
    });
  }
}

function transactionQuery(start: string, end: string, withCreatedAt: boolean, createdBy?: string | null): Query {
  const constraints = [];
  if (createdBy) constraints.push(where('createdBy', '==', createdBy));
  constraints.push(where('transactionDate', '>=', start), where('transactionDate', '<=', end), orderBy('transactionDate', 'desc'));
  if (withCreatedAt) constraints.push(orderBy('createdAt', 'desc'));
  return query(collection(getFirestoreDb(), 'transactions'), ...constraints);
}

async function addFirestoreTransaction(input: TransactionDraft, createdBy: string | null): Promise<void> {
  const barcode = input.barcode.trim();
  const name = input.name.trim();
  const reason = input.reason.trim();
  const message = firstError(validateTransaction({
    barcode,
    name,
    reason,
    action: input.action,
    transactionDate: input.transactionDate,
  }));
  if (message) throw new Error(message);
  if (!createdBy) throw new Error('Sign in before saving a transaction.');

  const timestamp = new Date().toISOString();
  const transactionTime = formatTime(timestamp);
  const database = getFirestoreDb();
  const transactionRef = doc(database, 'transactions', input.idempotencyKey);
  const itemRef = doc(database, 'items', itemDocId(barcode));
  const userRef = doc(database, 'users', createdBy);

  try {
    await runTransaction(database, async (transaction) => {
      const [existing, itemSnap, userSnap] = await Promise.all([
        transaction.get(transactionRef),
        transaction.get(itemRef),
        transaction.get(userRef),
      ]);
      if (existing.exists()) {
        const saved = transactionFromDoc(existing);
        if (saved && saved.barcode === barcode && saved.action === input.action && saved.transactionDate === input.transactionDate) {
          return;
        }
        throw new Error('This save was already recorded. Start again if this is a different transaction.');
      }

      const actor = userSnap.data();
      if (!actor || actor.status !== 'ACTIVE' || typeof actor.name !== 'string' || typeof actor.email !== 'string') {
        throw new Error('Your account cannot record transactions.');
      }
      const item = itemFromDoc(itemSnap);
      assertStatusChange(input.action, item);
      const recordedAction = input.action === 'TAKING' ? 'ITEM_TAKEN' : 'ITEM_RETURNED';

      transaction.set(transactionRef, {
        barcode,
        name,
        reason,
        action: input.action,
        transactionDate: input.transactionDate,
        transactionTime,
        createdAt: serverTimestamp(),
        createdBy,
        createdByName: actor.name,
        createdByEmail: actor.email,
      });
      transaction.set(itemRef, nextItemState({
        barcode,
        name,
        reason,
        action: input.action,
        transactionDate: input.transactionDate,
      }));
      transaction.set(doc(collection(database, 'auditLogs')), {
        userId: createdBy,
        userName: actor.name,
        userEmail: actor.email,
        action: recordedAction,
        description: input.action === 'TAKING'
          ? `Recorded a taking transaction for ${barcode}.`
          : `Recorded a returning transaction for ${barcode}.`,
        targetId: input.idempotencyKey,
        timestamp: serverTimestamp(),
        metadata: {
          barcode,
          transactionDate: input.transactionDate,
          action: input.action,
        },
      });
    });
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

function assertStatusChange(action: TransactionAction, item: ReturnType<typeof itemFromDoc>): void {
  if (action === 'TAKING') {
    if (item?.status === 'TAKEN') {
      const holder = item.currentHolder?.trim() || 'someone';
      throw new Error(`This item is already taken by ${holder}. Submit it back before taking it again.`);
    }
    return;
  }
  if (!item || item.status !== 'TAKEN') {
    throw new Error('This item is not currently taken, so it cannot be submitted back.');
  }
}

function nextItemState(input: {
  barcode: string;
  name: string;
  reason: string;
  action: TransactionAction;
  transactionDate: string;
}) {
  if (input.action === 'TAKING') {
    return {
      barcode: input.barcode,
      status: 'TAKEN',
      currentHolder: input.name,
      reason: input.reason,
      takenAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      lastTransactionDate: input.transactionDate,
    };
  }
  return {
    barcode: input.barcode,
    status: 'AVAILABLE',
    currentHolder: null,
    reason: null,
    takenAt: null,
    lastUpdated: serverTimestamp(),
    lastTransactionDate: input.transactionDate,
  };
}

function sortNewest(transactions: TransactionRecord[]): TransactionRecord[] {
  return [...transactions].sort((left, right) => {
    const day = transactionDay(right).localeCompare(transactionDay(left));
    if (day !== 0) return day;
    return right.timestamp.localeCompare(left.timestamp);
  });
}
