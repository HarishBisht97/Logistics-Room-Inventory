import { db } from './database';
import type { BackupFile, ItemRecord, TransactionAction, TransactionRecord } from '../types';
import { downloadBlob } from '../utils/download';

const ACTIONS = new Set<TransactionAction>(['TAKING', 'RETURNING']);

export async function getDataCounts(): Promise<{ transactions: number; items: number }> {
  const [transactions, items] = await Promise.all([
    db.transactions.count(),
    db.items.count(),
  ]);
  return { transactions, items };
}

export async function downloadJsonBackup(): Promise<void> {
  const [transactions, items] = await Promise.all([
    db.transactions.orderBy('id').toArray(),
    db.items.toArray(),
  ]);
  const payload: BackupFile = {
    app: 'logistics-inventory',
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'Logistics_Inventory_Backup.json');
}

export function parseBackup(value: unknown): BackupFile {
  if (!isRecord(value) || value.app !== 'logistics-inventory' || value.version !== 1) {
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
  const ids = new Set<number>();
  for (const transaction of transactions) {
    if (transaction.id !== undefined) {
      if (ids.has(transaction.id)) throw new Error('This backup contains duplicate transaction ids.');
      ids.add(transaction.id);
    }
  }
  const barcodes = new Set<string>();
  for (const item of items) {
    if (barcodes.has(item.barcode)) throw new Error('This backup contains duplicate item barcodes.');
    barcodes.add(item.barcode);
  }

  return {
    app: 'logistics-inventory',
    version: 1,
    exportedAt: value.exportedAt,
    transactions,
    items,
  };
}

export async function replaceAllData(backup: BackupFile): Promise<void> {
  let nextId = backup.transactions.reduce((max, transaction) => Math.max(max, transaction.id ?? 0), 0) + 1;
  const transactions = backup.transactions.map((transaction) => ({
    ...transaction,
    id: transaction.id ?? nextId++,
  }));

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
  if (value.id !== undefined && (typeof value.id !== 'number' || !Number.isInteger(value.id) || value.id < 1)) return false;
  if (typeof value.barcode !== 'string' || !value.barcode.trim() || value.barcode.trim().length > 128) return false;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80) return false;
  if (typeof value.reason !== 'string' || !value.reason.trim() || value.reason.trim().length > 300) return false;
  if (typeof value.action !== 'string' || !ACTIONS.has(value.action as TransactionAction)) return false;
  return isIso(value.timestamp);
}

function isItem(value: unknown): value is ItemRecord {
  if (!isRecord(value)) return false;
  if (typeof value.barcode !== 'string' || !value.barcode.trim() || value.barcode.trim().length > 128) return false;
  if (!isIso(value.lastUpdated)) return false;
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
  };
}
