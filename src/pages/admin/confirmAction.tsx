import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/ToastProvider';

interface PendingAction {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'neutral';
  success: string;
  run: () => Promise<void>;
}

export function useConfirmAction() {
  const toast = useToast();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await pending.run();
      toast.success(pending.success);
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not complete that action.');
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ''}
      description={pending?.description ?? ''}
      confirmLabel={pending?.confirmLabel ?? 'Confirm'}
      cancelLabel="Cancel"
      tone={pending?.tone ?? 'danger'}
      busy={busy}
      onConfirm={() => void onConfirm()}
      onCancel={() => {
        if (!busy) setPending(null);
      }}
    />
  );

  return { ask: setPending, dialog };
}
