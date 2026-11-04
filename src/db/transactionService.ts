import { db } from './database';
import type { TransactionAction, TransactionRecord } from '../types';
import { endOfToday, startOfToday } from '../utils/dateUtils';
import { firstError, validateTransaction } from '../utils/validation';

export interface NewTransaction {
  barcode: string;
  name: string;
  reason: string;
  action: TransactionAction;
}

export async function registerTransaction(input: NewTransaction): Promise<void> {
  const barcode = input.barcode.trim();
  const name = input.name.trim();
  const reason = input.reason.trim();
  const message = firstError(validateTransaction({ barcode, name, reason, action: input.action }));
  if (message) throw new Error(message);

  const timestamp = new Date().toISOString();

  await db.transaction('rw', db.transactions, db.items, async () => {
    const item = await db.items.get(barcode);

    if (input.action === 'TAKING') {
      if (item?.status === 'TAKEN') {
        const holder = item.currentHolder?.trim() || 'someone';
        throw new Error(`This item is already taken by ${holder}. Submit it back before taking it again.`);
      }

      await db.transactions.add({ barcode, name, reason, action: 'TAKING', timestamp });
      await db.items.put({
        barcode,
        status: 'TAKEN',
        currentHolder: name,
        reason,
        takenAt: timestamp,
        lastUpdated: timestamp,
      });
      return;
    }

    if (!item || item.status !== 'TAKEN') {
      throw new Error('This item is not currently taken, so it cannot be submitted back.');
    }

    await db.transactions.add({ barcode, name, reason, action: 'RETURNING', timestamp });
    await db.items.put({
      barcode,
      status: 'AVAILABLE',
      currentHolder: null,
      reason: null,
      takenAt: null,
      lastUpdated: timestamp,
    });
  });
}

export function listTransactions(): Promise<TransactionRecord[]> {
  return db.transactions.orderBy('timestamp').reverse().toArray();
}

export function listRecentTransactions(limit = 5): Promise<TransactionRecord[]> {
  return db.transactions.orderBy('timestamp').reverse().limit(limit).toArray();
}

export async function countTransactionsToday(): Promise<number> {
  const start = startOfToday();
  const end = endOfToday();
  const transactions = await db.transactions.toArray();
  return transactions.filter((transaction) => {
    const time = new Date(transaction.timestamp).getTime();
    return time >= start && time < end;
  }).length;
}
