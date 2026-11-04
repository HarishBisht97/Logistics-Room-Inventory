import Dexie, { type EntityTable } from 'dexie';
import type { ItemRecord, TransactionRecord } from '../types';

class LogisticsDatabase extends Dexie {
  transactions!: EntityTable<TransactionRecord, 'id'>;
  items!: EntityTable<ItemRecord, 'barcode'>;

  constructor() {
    super('LogisticsInventoryDB');
    this.version(1).stores({
      transactions: '++id, barcode, name, action, timestamp',
      items: 'barcode, status, currentHolder, takenAt',
    });
  }
}

export const db = new LogisticsDatabase();
