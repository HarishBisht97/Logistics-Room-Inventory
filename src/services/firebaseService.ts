import {
  collection,
  doc,
  getCountFromServer,
  getDocFromServer,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import { downloadJsonBackup, getDataCounts, replaceAllData, saveBackupFile } from '../db/backupService';
import { db } from '../db/database';
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from '../firebase/firebase';
import type { BackupFile, RestoreSummary } from '../types';
import { getAllItems } from './itemService';
import { getAllTransactions } from './transactionService';
import {
  backupTransactionId,
  explainFirestoreError,
  itemDocId,
  itemFromDoc,
  itemToFirestore,
  legacyTransactionId,
  transactionToFirestore,
} from './firestoreRecords';

const MIGRATION_KEY = 'logistics-firestore-migration-v1';

export function isMigrationComplete(): boolean {
  try {
    return localStorage.getItem(MIGRATION_KEY) === 'done';
  } catch {
    return false;
  }
}

export async function countStoredRecords(): Promise<{ transactions: number; items: number }> {
  if (!isFirebaseConfigured) return getDataCounts();
  try {
    const database = getFirestoreDb();
    const [transactions, items] = await Promise.all([
      getCountFromServer(collection(database, 'transactions')),
      getCountFromServer(collection(database, 'items')),
    ]);
    return { transactions: transactions.data().count, items: items.data().count };
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

export async function downloadCurrentBackup(): Promise<void> {
  if (!isFirebaseConfigured) {
    await downloadJsonBackup();
    return;
  }
  saveBackupFile(await buildCloudBackup());
}

export async function restoreStoredBackup(backup: BackupFile): Promise<RestoreSummary> {
  if (!isFirebaseConfigured) {
    await replaceAllData(backup);
    return { added: backup.transactions.length, duplicates: 0, itemsUpdated: backup.items.length };
  }
  return restoreCloudBackup(backup);
}

export async function buildCloudBackup(): Promise<BackupFile> {
  const [transactions, items] = await Promise.all([getAllTransactions(), getAllItems()]);
  return {
    app: 'logistics-inventory',
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions,
    items,
  };
}

export async function restoreCloudBackup(backup: BackupFile): Promise<RestoreSummary> {
  assertOnline('Connect to the internet before restoring a backup.');
  const createdBy = requireUserId();
  const database = getFirestoreDb();
  const transactionWrites: Write[] = [];
  let duplicates = 0;

  try {
    for (const record of backup.transactions) {
      const id = backupTransactionId(record);
      const existing = await getDocFromServer(doc(database, 'transactions', id));
      if (existing.exists()) {
        duplicates += 1;
        continue;
      }
      transactionWrites.push({ ref: doc(database, 'transactions', id), data: transactionToFirestore(record, createdBy) });
    }

    const itemWrites: Write[] = [];
    for (const item of backup.items) {
      const payload = itemToFirestore(item);
      if (!payload) continue;
      const ref = doc(database, 'items', itemDocId(item.barcode));
      const cloud = itemFromDoc(await getDocFromServer(ref));
      if (cloud && cloud.lastUpdated >= item.lastUpdated) continue;
      itemWrites.push({ ref, data: payload });
    }

    await commitWrites(transactionWrites);
    await commitWrites(itemWrites);
    return { added: transactionWrites.length, duplicates, itemsUpdated: itemWrites.length };
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

export async function migrateIndexedDbToFirestore(): Promise<{ transactions: number; items: number; skippedItems: number }> {
  assertOnline('Connect to the internet before uploading records from this device.');
  const createdBy = requireUserId();
  const database = getFirestoreDb();
  const [transactions, items] = await Promise.all([
    db.transactions.toArray(),
    db.items.toArray(),
  ]);

  const transactionWrites: Write[] = [];
  try {
    for (const record of transactions) {
      const id = legacyTransactionId(record);
      const existing = await getDocFromServer(doc(database, 'transactions', id));
      if (existing.exists()) continue;
      transactionWrites.push({
        ref: doc(database, 'transactions', id),
        data: transactionToFirestore(record, createdBy),
      });
    }

    const itemWrites: Write[] = [];
    let skippedItems = 0;
    for (const item of items) {
      const payload = itemToFirestore(item);
      if (!payload) {
        skippedItems += 1;
        continue;
      }
      const ref = doc(database, 'items', itemDocId(item.barcode));
      const cloud = itemFromDoc(await getDocFromServer(ref));
      if (cloud && cloud.lastUpdated >= item.lastUpdated) {
        skippedItems += 1;
        continue;
      }
      itemWrites.push({ ref, data: payload });
    }

    await commitWrites(transactionWrites);
    await commitWrites(itemWrites);
    await verifyTransactions(transactions.map((record) => legacyTransactionId(record)));
    localStorage.setItem(MIGRATION_KEY, 'done');
    return { transactions: transactionWrites.length, items: itemWrites.length, skippedItems };
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

async function verifyTransactions(ids: string[]): Promise<void> {
  const database = getFirestoreDb();
  for (const id of ids) {
    const snapshot = await getDocFromServer(doc(database, 'transactions', id));
    if (!snapshot.exists()) {
      throw new Error('Migration could not be verified. Records on this device were kept.');
    }
  }
}

type Write = { ref: DocumentReference; data: DocumentData };

async function commitWrites(writes: Write[]): Promise<void> {
  const database = getFirestoreDb();
  for (let index = 0; index < writes.length; index += 400) {
    const group = writes.slice(index, index + 400);
    const batch = writeBatch(database);
    for (const write of group) batch.set(write.ref, write.data);
    await batch.commit();
  }
}

function requireUserId(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error('Sign in before changing cloud records.');
  return uid;
}

function assertOnline(message: string): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error(message);
}
