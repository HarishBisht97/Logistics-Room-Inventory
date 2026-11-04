import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScrollText } from 'lucide-react';
import { ActionBadge } from '../components/ActionBadge';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { ExportExcelButton } from '../components/DataTools';
import { PageHeader } from '../components/PageHeader';
import { SearchField } from '../components/SearchField';
import { focusRing, secondaryButton, textInput } from '../components/styles';
import { listTransactions } from '../db/transactionService';
import type { TransactionAction, TransactionRecord } from '../types';
import { formatDate, formatTime, toDateKey } from '../utils/dateUtils';

type ActionFilter = 'ALL' | TransactionAction;

const FILTERS: { id: ActionFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'TAKING', label: 'Taking' },
  { id: 'RETURNING', label: 'Submitting Back' },
];

export default function TransactionHistory() {
  const transactions = useLiveQuery(() => listTransactions(), []);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<ActionFilter>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rangeError = from && to && from > to ? 'The start date is after the end date.' : '';

  const filtered = useMemo(() => {
    if (rangeError) return [];
    const needle = query.trim().toLowerCase();
    return (transactions ?? []).filter((transaction) => {
      if (action !== 'ALL' && transaction.action !== action) return false;
      const day = toDateKey(transaction.timestamp);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!needle) return true;
      return transaction.barcode.toLowerCase().includes(needle)
        || transaction.name.toLowerCase().includes(needle);
    });
  }, [transactions, query, action, from, to, rangeError]);

  const filtersActive = query.trim() !== '' || action !== 'ALL' || from !== '' || to !== '';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transaction history"
        description="Every take and return saved on this device."
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Excel export includes every record, not only the filtered list.</p>
        <ExportExcelButton className="w-full sm:w-auto" />
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <SearchField value={query} onChange={setQuery} placeholder="Search by barcode or name" />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const selected = action === filter.id;
            const tone = selected
              ? filter.id === 'TAKING'
                ? 'bg-orange-600 text-white'
                : filter.id === 'RETURNING'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700';
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setAction(filter.id)}
                className={`min-h-10 rounded-full px-3 text-sm font-semibold ${tone} ${focusRing}`}
                aria-pressed={selected}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${textInput} mt-1.5`} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={`${textInput} mt-1.5`} />
          </label>
        </div>
        {rangeError ? <p className="text-sm text-red-600" role="alert">{rangeError}</p> : null}
        {filtersActive ? (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setQuery('');
              setAction('ALL');
              setFrom('');
              setTo('');
            }}
          >
            Clear filters
          </button>
        ) : null}
      </section>

      {transactions === undefined ? <LoadingState label="Loading history" /> : null}
      {transactions && transactions.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No transactions yet"
          description="Takes and returns will show up here after the first scan."
        />
      ) : null}
      {transactions && transactions.length > 0 && filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No matching transactions"
          description="Try a different name, barcode, action, or date range."
        />
      ) : null}
      {filtered.length > 0 ? (
        <>
          <p className="text-sm text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
          </p>
          <HistoryTable transactions={filtered} />
          <HistoryCards transactions={filtered} />
        </>
      ) : null}
    </div>
  );
}

function HistoryTable({ transactions }: { transactions: TransactionRecord[] }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Barcode</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono font-medium text-slate-900">{transaction.barcode}</td>
                <td className="px-4 py-3 text-slate-800">{transaction.name}</td>
                <td className="max-w-xs px-4 py-3 text-slate-700">{transaction.reason}</td>
                <td className="px-4 py-3"><ActionBadge action={transaction.action} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDate(transaction.timestamp)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTime(transaction.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryCards({ transactions }: { transactions: TransactionRecord[] }) {
  return (
    <ul className="space-y-3 md:hidden">
      {transactions.map((transaction) => (
        <li key={transaction.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-sm font-semibold break-all text-slate-900">{transaction.barcode}</p>
            <ActionBadge action={transaction.action} />
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">{transaction.name}</p>
          <p className="mt-1 text-sm text-slate-700">{transaction.reason}</p>
          <p className="mt-2 text-xs text-slate-500">
            {formatDate(transaction.timestamp)} · {formatTime(transaction.timestamp)}
          </p>
        </li>
      ))}
    </ul>
  );
}
