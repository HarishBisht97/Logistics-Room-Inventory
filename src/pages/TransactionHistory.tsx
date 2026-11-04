import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { ActionBadge } from '../components/ActionBadge';
import { useAccess } from '../components/AccessProvider';
import { useAuth } from '../components/AuthGate';
import { DataTools } from '../components/DataTools';
import { DateNavigator, shiftRange } from '../components/DateNavigator';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SearchField } from '../components/SearchField';
import { useSelectedDate } from '../components/SelectedDateProvider';
import { focusRing, secondaryButton, textInput } from '../components/styles';
import { useDateTransactions } from '../services/useLogisticsData';
import type { TransactionAction, TransactionRecord } from '../types';
import { formatDateKey, formatLongRange, isDateKey, todayKey, transactionClock, transactionDay } from '../utils/dateUtils';

type ActionFilter = 'ALL' | TransactionAction;

const FILTERS: { id: ActionFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'TAKING', label: 'Taking' },
  { id: 'RETURNING', label: 'Submitting Back' },
];

export default function TransactionHistory() {
  const { date } = useSelectedDate();
  const { configured } = useAuth();
  const access = useAccess();
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<ActionFilter>('ALL');
  const [from, setFrom] = useState(date);
  const [to, setTo] = useState(date);
  const rangeError = from && to && from > to ? 'The start date is after the end date.' : '';
  const records = useDateTransactions(from, to);

  const filtered = useMemo(() => {
    if (rangeError) return [];
    const needle = query.trim().toLowerCase();
    return (records.data ?? []).filter((transaction) => {
      if (action !== 'ALL' && transaction.action !== action) return false;
      if (!needle) return true;
      return transaction.barcode.toLowerCase().includes(needle)
        || transaction.name.toLowerCase().includes(needle)
        || (transaction.createdByName ?? '').toLowerCase().includes(needle);
    });
  }, [records.data, query, action, rangeError]);

  const filtersActive = query.trim() !== '' || action !== 'ALL' || from !== todayKey() || to !== todayKey();
  if (access.configured && !access.featureEnabled('history')) {
    return <PageHeader title="Transaction history" description="History is turned off for your account." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transaction history"
        description={
          configured
            ? `${formatLongRange(from, to)} from Firestore.`
            : `${formatLongRange(from, to)} saved on this device.`
        }
      />
      <DateNavigator
        date={from}
        onChange={(next) => {
          const shifted = shiftRange(from, to, next);
          setFrom(shifted.start);
          setTo(shifted.end);
        }}
        onToday={() => {
          const today = todayKey();
          setFrom(today);
          setTo(today);
        }}
      />
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
            <input
              type="date"
              value={from}
              onChange={(event) => {
                if (isDateKey(event.target.value)) setFrom(event.target.value);
              }}
              className={`${textInput} mt-1.5`}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => {
                if (isDateKey(event.target.value)) setTo(event.target.value);
              }}
              className={`${textInput} mt-1.5`}
            />
          </label>
        </div>
        <p className="text-sm text-slate-500">Showing {formatLongRange(from, to)}.</p>
        {rangeError ? <p className="text-sm text-red-600" role="alert">{rangeError}</p> : null}
        {records.error ? <p className="text-sm text-red-600" role="alert">{records.error}</p> : null}
        {filtersActive ? (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              const today = todayKey();
              setQuery('');
              setAction('ALL');
              setFrom(today);
              setTo(today);
            }}
          >
            Clear filters
          </button>
        ) : null}
      </section>

      <DataTools date={from} start={from} end={to} />

      {records.loading ? <LoadingState label="Loading history" /> : null}
      {records.data && records.data.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No transactions in this range"
          description="Takes and returns for these dates will show up here."
        />
      ) : null}
      {records.data && records.data.length > 0 && filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No matching transactions"
          description="Try a different name, barcode, or action."
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
              <th className="px-4 py-3 font-medium">Transaction date</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={String(transaction.id ?? `${transaction.barcode}-${transaction.timestamp}`)} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono font-medium text-slate-900">{transaction.barcode}</td>
                <td className="px-4 py-3 text-slate-800">{transaction.name}</td>
                <td className="max-w-xs px-4 py-3 text-slate-700">{transaction.reason}</td>
                <td className="px-4 py-3"><ActionBadge action={transaction.action} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDateKey(transactionDay(transaction))}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{transactionClock(transaction)}</td>
                <td className="px-4 py-3 text-slate-700">{transaction.createdByName || '—'}</td>
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
        <li key={String(transaction.id ?? `${transaction.barcode}-${transaction.timestamp}`)} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-sm font-semibold break-all text-slate-900">{transaction.barcode}</p>
            <ActionBadge action={transaction.action} />
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">{transaction.name}</p>
          <p className="mt-1 text-sm text-slate-700">{transaction.reason}</p>
          <p className="mt-2 text-xs text-slate-500">
            {formatDateKey(transactionDay(transaction))} · {transactionClock(transaction)}
            {transaction.createdByName ? ` · Recorded by ${transaction.createdByName}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
