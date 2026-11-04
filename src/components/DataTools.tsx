import { useRef, useState, type ChangeEvent } from 'react';
import { Download, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { parseBackup } from '../db/backupService';
import { isFirebaseConfigured } from '../firebase/firebase';
import { countStoredRecords, downloadCurrentBackup, restoreStoredBackup } from '../services/firebaseService';
import type { BackupFile, RestoreSummary } from '../types';
import { formatDateTime, formatLongRange, isDateKey } from '../utils/dateUtils';
import { downloadInventoryExcel, type ExcelExportScope } from '../utils/excelExport';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './ToastProvider';
import { secondaryButton } from './styles';

interface DataToolsProps {
  date: string;
  start?: string;
  end?: string;
  showBackup?: boolean;
}

export function DataTools({ date, start, end, showBackup = true }: DataToolsProps) {
  const rangeStart = start && isDateKey(start) ? start : date;
  const rangeEnd = end && isDateKey(end) ? end : date;
  const hasRange = rangeStart !== rangeEnd && rangeStart < rangeEnd;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Records</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Excel files use the latest saved records. A date export contains only that date.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ExportButton scope={{ kind: 'date', date: rangeStart }} label={`Export ${formatLongRange(rangeStart, rangeStart)}`} />
        {hasRange ? (
          <ExportButton scope={{ kind: 'range', start: rangeStart, end: rangeEnd }} label={`Export ${formatLongRange(rangeStart, rangeEnd)}`} />
        ) : null}
        <ExportButton scope={{ kind: 'all' }} label="Export all transactions" />
        <ExportButton scope={{ kind: 'taken' }} label="Export currently taken" />
      </div>
      {showBackup ? <BackupTools /> : null}
    </section>
  );
}

function ExportButton({ scope, label }: { scope: ExcelExportScope; label: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await downloadInventoryExcel(scope);
      toast.success('Excel file downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the Excel file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className={`${secondaryButton} w-full`}>
      {busy ? <LoaderCircle className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
      {label}
    </button>
  );
}

function BackupTools() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [current, setCurrent] = useState({ transactions: 0, items: 0 });
  const cloud = isFirebaseConfigured;

  async function onBackup() {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      await downloadCurrentBackup();
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
      const counts = await countStoredRecords();
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
      const summary = await restoreStoredBackup(pending);
      setPending(null);
      toast.success(restoreSuccess(summary, cloud));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore the backup.');
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="grid gap-2 sm:grid-cols-2">
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
        title={cloud ? 'Add this backup to Firestore?' : 'Replace data on this device?'}
        description={pending ? restoreDescription(pending, current, cloud) : ''}
        confirmLabel={cloud ? 'Add backup records' : 'Replace existing data'}
        cancelLabel="Keep current data"
        busy={restoreBusy}
        onConfirm={confirmRestore}
        onCancel={() => {
          if (!restoreBusy) setPending(null);
        }}
      />
    </div>
  );
}

function restoreDescription(
  backup: BackupFile,
  current: { transactions: number; items: number },
  cloud: boolean,
): string {
  const when = formatDateTime(backup.exportedAt);
  const incoming = `${countPhrase(backup.transactions.length, 'transaction')} and ${countPhrase(backup.items.length, 'item')}`;
  if (cloud) {
    return `This backup from ${when} contains ${incoming}. Transactions that already exist are skipped. Current item status is updated only when the backup is newer. Existing transaction history is not deleted.`;
  }
  if (current.transactions === 0 && current.items === 0) {
    return `This backup from ${when} contains ${incoming}. This device has no saved records yet. Restoring will load this backup.`;
  }
  const existing = `${countPhrase(current.transactions, 'transaction')} and ${countPhrase(current.items, 'item')}`;
  return `This backup from ${when} contains ${incoming}. Restoring will replace the ${existing} already stored on this device. Current transaction history will be overwritten.`;
}

function restoreSuccess(summary: RestoreSummary, cloud: boolean): string {
  if (!cloud) return 'Backup restored on this device.';
  return `Added ${countPhrase(summary.added, 'transaction')}. Skipped ${countPhrase(summary.duplicates, 'duplicate')}. Updated ${countPhrase(summary.itemsUpdated, 'item')}.`;
}

function countPhrase(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
