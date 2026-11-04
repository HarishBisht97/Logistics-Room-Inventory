import { useRef, useState, type ChangeEvent } from 'react';
import { Download, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { downloadJsonBackup, getDataCounts, parseBackup, replaceAllData } from '../db/backupService';
import type { BackupFile } from '../types';
import { formatDateTime } from '../utils/dateUtils';
import { downloadInventoryExcel } from '../utils/excelExport';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './ToastProvider';
import { secondaryButton } from './styles';

export function ExportExcelButton({ className = '' }: { className?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await downloadInventoryExcel();
      toast.success('Excel file downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the Excel file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className={`${secondaryButton} ${className}`}>
      {busy ? <LoaderCircle className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
      Export to Excel
    </button>
  );
}

export function DataTools() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [current, setCurrent] = useState({ transactions: 0, items: 0 });

  async function onBackup() {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      await downloadJsonBackup();
      toast.success('JSON backup downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the backup.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = parseBackup(JSON.parse(await file.text()) as unknown);
      const counts = await getDataCounts();
      setCurrent(counts);
      setPending(parsed);
    } catch (error) {
      const message = error instanceof SyntaxError
        ? 'That file is not valid JSON.'
        : error instanceof Error
          ? error.message
          : 'Could not read that backup.';
      toast.error(message);
    }
  }

  async function confirmRestore() {
    if (!pending || restoreBusy) return;
    setRestoreBusy(true);
    try {
      await replaceAllData(pending);
      setPending(null);
      toast.success('Backup restored on this device.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore the backup.');
    } finally {
      setRestoreBusy(false);
    }
  }

  const description = pending
    ? restoreDescription(pending, current)
    : '';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Records</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Excel and JSON files are created in this browser from the latest saved data.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ExportExcelButton className="w-full" />
        <button type="button" onClick={onBackup} disabled={backupBusy} className={`${secondaryButton} w-full`}>
          {backupBusy ? <LoaderCircle className="animate-spin" size={18} /> : <Download size={18} />}
          JSON backup
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={`${secondaryButton} w-full`}>
          <Upload size={18} />
          Restore backup
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
      />
      <ConfirmDialog
        open={pending !== null}
        title="Replace data on this device?"
        description={description}
        confirmLabel="Replace existing data"
        cancelLabel="Keep current data"
        busy={restoreBusy}
        onConfirm={confirmRestore}
        onCancel={() => {
          if (!restoreBusy) setPending(null);
        }}
      />
    </section>
  );
}

function restoreDescription(
  backup: BackupFile,
  current: { transactions: number; items: number },
): string {
  const when = formatDateTime(backup.exportedAt);
  const incoming = `${countPhrase(backup.transactions.length, 'transaction')} and ${countPhrase(backup.items.length, 'item')}`;
  if (current.transactions === 0 && current.items === 0) {
    return `This backup from ${when} contains ${incoming}. This device has no saved records yet. Restoring will load this backup.`;
  }
  const existing = `${countPhrase(current.transactions, 'transaction')} and ${countPhrase(current.items, 'item')}`;
  return `This backup from ${when} contains ${incoming}. Restoring will replace the ${existing} already stored on this device. Current transaction history will be overwritten.`;
}

function countPhrase(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
