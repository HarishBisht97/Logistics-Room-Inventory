export type TransactionAction = 'TAKING' | 'RETURNING';

export type ItemStatus = 'AVAILABLE' | 'TAKEN';

export interface TransactionRecord {
  id?: number;
  barcode: string;
  name: string;
  reason: string;
  action: TransactionAction;
  timestamp: string;
}

export interface ItemRecord {
  barcode: string;
  status: ItemStatus;
  currentHolder: string | null;
  reason: string | null;
  takenAt: string | null;
  lastUpdated: string;
}

export interface DashboardStats {
  uniqueItems: number;
  taken: number;
  available: number;
  transactionsToday: number;
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
  version: 1;
  exportedAt: string;
  transactions: TransactionRecord[];
  items: ItemRecord[];
}
