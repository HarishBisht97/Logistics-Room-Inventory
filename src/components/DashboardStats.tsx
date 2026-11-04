import { PackageOpen, RotateCcw, ScrollText } from 'lucide-react';
import type { DateDashboardStats } from '../types';

const CARDS = [
  { key: 'transactions', label: 'Transactions', icon: ScrollText, iconClass: 'bg-slate-100 text-slate-700' },
  { key: 'taking', label: 'Taking', icon: PackageOpen, iconClass: 'bg-orange-50 text-orange-700' },
  { key: 'returning', label: 'Returning', icon: RotateCcw, iconClass: 'bg-emerald-50 text-emerald-700' },
] as const;

export function DashboardStats({
  stats,
  loading,
}: {
  stats: DateDashboardStats | null;
  loading: boolean;
}) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-3 gap-3" role="status" aria-label="Loading summary">
        {CARDS.map((card) => (
          <div key={card.key} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className={`grid h-9 w-9 place-items-center rounded-xl ${card.iconClass}`}>
              <Icon size={18} />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {stats[card.key]}
            </p>
            <p className="mt-1 text-sm text-slate-500">{card.label}</p>
          </article>
        );
      })}
    </div>
  );
}
