import { useLiveQuery } from 'dexie-react-hooks';
import { ScrollText } from 'lucide-react';
import { listRecentTransactions } from '../db/transactionService';
import { formatDateTime } from '../utils/dateUtils';
import { ActionBadge } from './ActionBadge';
import { EmptyState, LoadingState } from './EmptyState';

export function RecentActivity() {
  const transactions = useLiveQuery(() => listRecentTransactions(5), []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Latest transactions</h2>
        <span className="text-xs text-slate-400">Last 5</span>
      </div>
      {transactions === undefined ? <LoadingState label="Loading transactions" /> : null}
      {transactions && transactions.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No transactions yet"
          description="Scan a barcode to record the first item leaving or returning to the room."
        />
      ) : null}
      {transactions && transactions.length > 0 ? (
        <ul>
          {transactions.map((transaction) => (
            <li key={transaction.id} className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-mono text-sm font-semibold text-slate-900">{transaction.barcode}</p>
                  <ActionBadge action={transaction.action} />
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">{transaction.name}</p>
              </div>
              <time className="shrink-0 text-right text-xs leading-5 text-slate-500" dateTime={transaction.timestamp}>
                {formatDateTime(transaction.timestamp)}
              </time>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
