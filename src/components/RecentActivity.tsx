import { ScrollText } from 'lucide-react';
import type { TransactionRecord } from '../types';
import { formatLongDate, transactionClock, transactionDay, formatDateKey } from '../utils/dateUtils';
import { ActionBadge } from './ActionBadge';
import { EmptyState, LoadingState } from './EmptyState';

export function RecentActivity({
  date,
  transactions,
  loading,
}: {
  date: string;
  transactions: TransactionRecord[] | undefined;
  loading: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Activity on {formatLongDate(date)}</h2>
      {loading ? <LoadingState label="Loading transactions" /> : null}
      {transactions && transactions.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No transactions on this date"
          description="Takes and returns recorded for this day will show up here."
        />
      ) : null}
      {transactions && transactions.length > 0 ? (
        <ul className="max-h-[28rem] overflow-y-auto">
          {transactions.map((transaction) => (
            <li key={String(transaction.id ?? `${transaction.barcode}-${transaction.timestamp}`)} className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-mono text-sm font-semibold text-slate-900">{transaction.barcode}</p>
                  <ActionBadge action={transaction.action} />
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">{transaction.name}</p>
              </div>
              <time className="shrink-0 text-right text-xs leading-5 text-slate-500" dateTime={transaction.timestamp}>
                {formatDateKey(transactionDay(transaction))}
                <br />
                {transactionClock(transaction)}
              </time>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
