import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../db/database';
import { getItem, listTakenItems } from '../db/itemService';
import { getFirestoreDb, isFirebaseConfigured } from '../firebase/firebase';
import type { DateDashboardStats, ItemRecord } from '../types';
import { explainFirestoreError, itemDocId, itemFromDoc, itemToFirestore } from './firestoreRecords';
import { getTransactionsByDate } from './transactionService';

export async function getItemByBarcode(barcode: string): Promise<ItemRecord | null> {
  const key = barcode.trim();
  if (!key) return null;
  if (!isFirebaseConfigured) return (await getItem(key)) ?? null;
  const snapshot = await getDoc(doc(getFirestoreDb(), 'items', itemDocId(key)));
  return itemFromDoc(snapshot);
}

export async function getCurrentlyTakenItems(): Promise<ItemRecord[]> {
  if (!isFirebaseConfigured) return listTakenItems();
  const snapshot = await getDocs(query(collection(getFirestoreDb(), 'items'), where('status', '==', 'TAKEN')));
  return sortTaken(snapshot.docs.flatMap((item) => {
    const record = itemFromDoc(item);
    return record ? [record] : [];
  }));
}

export async function getAllItems(): Promise<ItemRecord[]> {
  if (!isFirebaseConfigured) return db.items.toArray();
  const snapshot = await getDocs(collection(getFirestoreDb(), 'items'));
  return snapshot.docs.flatMap((item) => {
    const record = itemFromDoc(item);
    return record ? [record] : [];
  });
}

export async function getDashboardStats(date: string): Promise<DateDashboardStats> {
  const transactions = await getTransactionsByDate(date);
  return {
    transactions: transactions.length,
    taking: transactions.filter((transaction) => transaction.action === 'TAKING').length,
    returning: transactions.filter((transaction) => transaction.action === 'RETURNING').length,
  };
}

export async function updateItemStatus(item: ItemRecord): Promise<boolean> {
  if (!isFirebaseConfigured) {
    await db.items.put(item);
    return true;
  }
  const payload = itemToFirestore(item);
  if (!payload) throw new Error(`The record for ${item.barcode} is incomplete, so its status was not changed.`);
  const ref = doc(getFirestoreDb(), 'items', itemDocId(item.barcode));
  try {
    return await runTransaction(getFirestoreDb(), async (transaction) => {
      const existing = itemFromDoc(await transaction.get(ref));
      if (existing && existing.lastUpdated >= item.lastUpdated) return false;
      transaction.set(ref, payload);
      return true;
    });
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

export function watchTakenItems(
  onData: (items: ItemRecord[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const takenQuery = query(collection(getFirestoreDb(), 'items'), where('status', '==', 'TAKEN'));
  return onSnapshot(takenQuery, (snapshot) => {
    onData(sortTaken(snapshot.docs.flatMap((item) => {
      const record = itemFromDoc(item);
      return record ? [record] : [];
    })));
  }, (error) => onError(explainFirestoreError(error)));
}

export function watchItem(
  barcode: string,
  onData: (item: ItemRecord | null) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const ref = doc(getFirestoreDb(), 'items', itemDocId(barcode));
  return onSnapshot(ref, (snapshot) => onData(itemFromDoc(snapshot)), (error) => onError(explainFirestoreError(error)));
}

function sortTaken(items: ItemRecord[]): ItemRecord[] {
  return [...items].sort((left, right) => (right.takenAt ?? '').localeCompare(left.takenAt ?? ''));
}
