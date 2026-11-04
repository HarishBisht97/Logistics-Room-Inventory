import { countTransactionsToday } from './transactionService';
import { db } from './database';
import type { DashboardStats, ItemRecord } from '../types';

export function getItem(barcode: string): Promise<ItemRecord | undefined> {
  return db.items.get(barcode.trim());
}

export async function listTakenItems(): Promise<ItemRecord[]> {
  const items = await db.items.where('status').equals('TAKEN').toArray();
  return items.sort((left, right) => (right.takenAt ?? '').localeCompare(left.takenAt ?? ''));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [items, transactionsToday] = await Promise.all([
    db.items.toArray(),
    countTransactionsToday(),
  ]);

  return {
    uniqueItems: items.length,
    taken: items.filter((item) => item.status === 'TAKEN').length,
    available: items.filter((item) => item.status === 'AVAILABLE').length,
    transactionsToday,
  };
}
