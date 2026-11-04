import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getItem, listTakenItems } from '../db/itemService';
import { listTransactionsByDateRange } from '../db/transactionService';
import { isFirebaseConfigured } from '../firebase/firebase';
import type { ItemRecord, TransactionRecord } from '../types';
import { isDateKey } from '../utils/dateUtils';
import { watchItem, watchTakenItems } from './itemService';
import { watchTransactions } from './transactionService';

export interface RecordState<T> {
  data: T | undefined;
  loading: boolean;
  error: string;
}

const idleItem = { state: 'idle' as const, item: null };

export function useDateTransactions(start: string, end: string): RecordState<TransactionRecord[]> {
  const cloud = isFirebaseConfigured;
  const valid = isDateKey(start) && isDateKey(end) && start <= end;
  const [remote, setRemote] = useState<TransactionRecord[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cloud) return undefined;
    if (!valid) {
      setRemote([]);
      setError('');
      return undefined;
    }
    setRemote(undefined);
    setError('');
    return watchTransactions(start, end, (rows) => {
      setRemote(rows);
      setError('');
    }, setError);
  }, [cloud, start, end, valid]);

  const local = useLiveQuery(async () => {
    if (cloud) return undefined;
    if (!valid) return [];
    return listTransactionsByDateRange(start, end);
  }, [cloud, start, end, valid]);

  if (!cloud) return { data: local, loading: local === undefined, error: '' };
  return { data: remote, loading: remote === undefined && error === '', error };
}

export function useTakenItems(): RecordState<ItemRecord[]> {
  const cloud = isFirebaseConfigured;
  const [remote, setRemote] = useState<ItemRecord[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cloud) return undefined;
    return watchTakenItems(setRemote, setError);
  }, [cloud]);

  const local = useLiveQuery(async () => {
    if (cloud) return undefined;
    return listTakenItems();
  }, [cloud]);

  if (!cloud) return { data: local, loading: local === undefined, error: '' };
  return { data: remote, loading: remote === undefined && error === '', error };
}

export function useItemLookup(barcode: string): { state: 'idle' | 'done' | 'error'; item: ItemRecord | null; message?: string } {
  const cloud = isFirebaseConfigured;
  const key = barcode.trim();
  const [remote, setRemote] = useState<{ state: 'idle' | 'done' | 'error'; item: ItemRecord | null; message?: string }>(idleItem);

  useEffect(() => {
    if (!cloud) return undefined;
    if (!key) {
      setRemote(idleItem);
      return undefined;
    }
    return watchItem(
      key,
      (item) => setRemote({ state: 'done', item }),
      (message) => setRemote({ state: 'error', item: null, message }),
    );
  }, [cloud, key]);

  const local = useLiveQuery(async () => {
    if (cloud) return undefined;
    if (!key) return idleItem;
    const item = await getItem(key);
    return { state: 'done' as const, item: item ?? null };
  }, [cloud, key]);

  if (!cloud) return local ?? idleItem;
  return remote;
}
