import Dexie, { type EntityTable } from 'dexie';
import type { ItemRecord, TransactionRecord } from '../types';
import { formatTime, toDateKey } from '../utils/dateUtils';

class LogisticsDatabase extends Dexie {
  transactions!: EntityTable<TransactionRecord, 'id'>;
  items!: EntityTable<ItemRecord, 'barcode'>;

  constructor() {
    super('LogisticsInventoryDB');
    this.version(1).stores({
      transactions: '++id, barcode, name, action, timestamp',
      items: 'barcode, status, currentHolder, takenAt',
    });
    this.version(2)
      .stores({
        transactions: '++id, barcode, name, action, timestamp, transactionDate, idempotencyKey',
        items: 'barcode, status, currentHolder, takenAt',
      })
      .upgrade((transaction) => transaction.table('transactions').toCollection().modify((record: TransactionRecord) => {
        if (!record.transactionDate && record.timestamp) {
          record.transactionDate = toDateKey(record.timestamp);
          record.transactionTime = formatTime(record.timestamp);
        }
      }));
  }
}

export const db = new LogisticsDatabase();
