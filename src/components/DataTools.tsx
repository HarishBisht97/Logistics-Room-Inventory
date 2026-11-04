import { useState } from 'react';
import { FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { formatLongRange, isDateKey } from '../utils/dateUtils';
import { downloadInventoryExcel, type ExcelExportScope } from '../utils/excelExport';
import { useToast } from './ToastProvider';
import { secondaryButton } from './styles';

interface DataToolsProps {
  date: string;
  start?: string;
  end?: string;
}

export function DataTools({ date, start, end }: DataToolsProps) {
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
