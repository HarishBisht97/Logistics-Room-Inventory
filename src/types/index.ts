export type TransactionAction = 'TAKING' | 'RETURNING';

export type ItemStatus = 'AVAILABLE' | 'TAKEN';

export interface TransactionRecord {
  id?: number | string;
  barcode: string;
  name: string;
  reason: string;
  action: TransactionAction;
  /** Actual submission time. This is not the calendar date of the record. */
  timestamp: string;
  /** User-selected calendar date, YYYY-MM-DD. */
  transactionDate?: string;
  transactionTime?: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  idempotencyKey?: string;
}

export interface ItemRecord {
  barcode: string;
  status: ItemStatus;
  currentHolder: string | null;
  reason: string | null;
  takenAt: string | null;
  lastUpdated: string;
  lastTransactionDate?: string | null;
}

export interface DashboardStats {
  uniqueItems: number;
  taken: number;
  available: number;
  transactionsToday: number;
}

export interface DateDashboardStats {
  transactions: number;
  taking: number;
  returning: number;
}

export interface RestoreSummary {
  added: number;
  duplicates: number;
  itemsUpdated: number;
}

export interface ScanLocationState {
  barcode?: string;
  name?: string;
  action?: TransactionAction;
  lockBarcode?: boolean;
  returnTo?: string;
  reset?: number;
}

export interface BackupFile {
  app: 'logistics-inventory';
  version: 1 | 2;
  exportedAt: string;
  transactions: TransactionRecord[];
  items: ItemRecord[];
}
