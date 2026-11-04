import { Undo2 } from 'lucide-react';
import type { ItemRecord } from '../types';
import { formatDate, formatDateKey, formatTime } from '../utils/dateUtils';
import { greenButton } from './styles';

interface TakenItemCardProps {
  item: ItemRecord;
  onReturn?: (item: ItemRecord) => void;
}

export function TakenItemCard({ item, onReturn }: TakenItemCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-sm font-semibold break-all text-slate-900">{item.barcode}</p>
        <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
          Taken
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Taken by</dt>
          <dd className="text-right font-medium text-slate-900">{item.currentHolder}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Reason</dt>
          <dd className="mt-0.5 text-slate-800">{item.reason}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Date taken</dt>
          <dd className="text-right text-slate-800">{item.lastTransactionDate ? formatDateKey(item.lastTransactionDate) : item.takenAt ? formatDate(item.takenAt) : '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Time taken</dt>
          <dd className="text-right text-slate-800">{item.takenAt ? formatTime(item.takenAt) : '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Status</dt>
          <dd className="text-right font-medium text-orange-700">Taken</dd>
        </div>
      </dl>
      {onReturn ? (
        <button type="button" onClick={() => onReturn(item)} className={`${greenButton} mt-4 w-full`}>
          <Undo2 size={18} />
          Submit back
        </button>
      ) : null}
    </article>
  );
}
