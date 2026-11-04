import { db } from './database';
import type { TransactionAction, TransactionRecord } from '../types';
import { formatTime, isDateKey, todayKey, toDateKey } from '../utils/dateUtils';
import { firstError, validateTransaction } from '../utils/validation';

export interface NewTransaction {
  barcode: string;
  name: string;
  reason: string;
  action: TransactionAction;
  transactionDate?: string;
  idempotencyKey?: string;
}

export async function registerTransaction(input: NewTransaction): Promise<void> {
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

  const timestamp = new Date().toISOString();
  const transactionDate = input.transactionDate ?? toDateKey(timestamp);
  if (!isDateKey(transactionDate)) throw new Error('Choose a valid transaction date.');
  const transactionTime = formatTime(timestamp);

  await db.transaction('rw', db.transactions, db.items, async () => {
    if (input.idempotencyKey) {
      const existing = await db.transactions.where('idempotencyKey').equals(input.idempotencyKey).first();
      if (existing) return;
    }

    const item = await db.items.get(barcode);

    if (input.action === 'TAKING') {
      if (item?.status === 'TAKEN') {
        const holder = item.currentHolder?.trim() || 'someone';
        throw new Error(`This item is already taken by ${holder}. Submit it back before taking it again.`);
      }

      await db.transactions.add({
        barcode,
        name,
        reason,
        action: 'TAKING',
        timestamp,
        transactionDate,
        transactionTime,
        createdBy: null,
        idempotencyKey: input.idempotencyKey,
      });
      await db.items.put({
        barcode,
        status: 'TAKEN',
        currentHolder: name,
        reason,
        takenAt: timestamp,
        lastUpdated: timestamp,
        lastTransactionDate: transactionDate,
      });
      return;
    }

    if (!item || item.status !== 'TAKEN') {
      throw new Error('This item is not currently taken, so it cannot be submitted back.');
    }

    await db.transactions.add({
      barcode,
      name,
      reason,
      action: 'RETURNING',
      timestamp,
      transactionDate,
      transactionTime,
      createdBy: null,
      idempotencyKey: input.idempotencyKey,
    });
    await db.items.put({
      barcode,
      status: 'AVAILABLE',
      currentHolder: null,
      reason: null,
      takenAt: null,
      lastUpdated: timestamp,
      lastTransactionDate: transactionDate,
    });
  });
}

export function listTransactions(): Promise<TransactionRecord[]> {
  return db.transactions.orderBy('timestamp').reverse().toArray();
}

export async function listTransactionsByDate(date: string): Promise<TransactionRecord[]> {
  const rows = await db.transactions.where('transactionDate').equals(date).toArray();
  return rows.sort(newestFirst);
}

export async function listTransactionsByDateRange(start: string, end: string): Promise<TransactionRecord[]> {
  const rows = await db.transactions.where('transactionDate').between(start, end, true, true).toArray();
  return rows.sort(newestFirst);
}

export async function countTransactionsToday(): Promise<number> {
  return db.transactions.where('transactionDate').equals(todayKey()).count();
}

function newestFirst(left: TransactionRecord, right: TransactionRecord): number {
  const day = (right.transactionDate ?? right.timestamp).localeCompare(left.transactionDate ?? left.timestamp);
  if (day !== 0) return day;
  return right.timestamp.localeCompare(left.timestamp);
}
