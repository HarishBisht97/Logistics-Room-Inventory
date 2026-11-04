import { useEffect, useState } from 'react';
import { onSnapshot, collection, limit, query } from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../firebase/firebase';

type SyncState = 'device' | 'synced' | 'syncing' | 'offline';

export function SyncStatus() {
  const [state, setState] = useState<SyncState>(isFirebaseConfigured ? 'syncing' : 'device');

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    const database = getFirestoreDb();
    const update = (pending: boolean, fromCache: boolean) => {
      if (!navigator.onLine) {
        setState(pending ? 'syncing' : 'offline');
        return;
      }
      setState(pending || fromCache ? 'syncing' : 'synced');
    };
    const onOnline = () => update(false, false);
    const onOffline = () => setState('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const unsubscribe = onSnapshot(
      query(collection(database, 'items'), limit(1)),
      { includeMetadataChanges: true },
      (snapshot) => update(snapshot.metadata.hasPendingWrites, snapshot.metadata.fromCache),
      () => setState(navigator.onLine ? 'syncing' : 'offline'),
    );
    return () => {
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const label = state === 'device'
    ? 'On this device'
    : state === 'offline'
      ? 'Offline'
      : state === 'syncing'
        ? 'Syncing'
        : 'Synced';

  const tone = state === 'offline' ? 'bg-amber-500' : state === 'synced' ? 'bg-emerald-500' : 'bg-slate-400';

  return (
    <p className="flex items-center gap-2 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full ${tone}`} aria-hidden="true" />
      <span>{label}</span>
    </p>
  );
}
