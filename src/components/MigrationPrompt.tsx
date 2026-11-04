import { useEffect, useState } from 'react';
import { getDataCounts } from '../db/backupService';
import { isFirebaseConfigured } from '../firebase/firebase';
import { isMigrationComplete, migrateIndexedDbToFirestore } from '../services/firebaseService';
import { useAccess } from './AccessProvider';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './ToastProvider';

export function MigrationPrompt() {
  const toast = useToast();
  const access = useAccess();
  const [counts, setCounts] = useState<{ transactions: number; items: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !access.isSuperAdmin || isMigrationComplete()) return undefined;
    let active = true;
    getDataCounts().then((next) => {
      if (!active) return;
      setCounts(next);
      if (next.transactions > 0 || next.items > 0) setOpen(true);
    }).catch(() => {
      if (active) toast.error('Could not read the records saved on this device.');
    });
    return () => {
      active = false;
    };
  }, [toast, access.isSuperAdmin]);

  if (!open || !counts) return null;

  const description = `${countPhrase(counts.transactions, 'transaction')} and ${countPhrase(counts.items, 'item')} are saved on this device. Upload them to Firestore? Records that were already uploaded are skipped. The copies on this device stay until you remove them yourself.`;

  return (
    <ConfirmDialog
      open={open}
      title="Upload records from this device?"
      description={description}
      confirmLabel="Upload records"
      cancelLabel="Not now"
      busy={busy}
      onCancel={() => {
        if (!busy) setOpen(false);
      }}
      onConfirm={() => {
        if (busy) return;
        setBusy(true);
        migrateIndexedDbToFirestore()
          .then((result) => {
            const uploaded = result.transactions + result.items;
            toast.success(
              uploaded === 0
                ? 'Those records are already in Firestore. The copies on this device were kept.'
                : `Uploaded ${countPhrase(result.transactions, 'transaction')} and ${countPhrase(result.items, 'item')}. The copies on this device were kept.`,
            );
            setOpen(false);
          })
          .catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Could not upload the records.');
            setBusy(false);
          });
      }}
    />
  );
}

function countPhrase(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
