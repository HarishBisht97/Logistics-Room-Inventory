import { useLiveQuery } from 'dexie-react-hooks';
import { Package, PackageCheck, PackageOpen, ScrollText } from 'lucide-react';
import { getDashboardStats } from '../db/itemService';
import type { DashboardStats as Stats } from '../types';

const CARDS = [
  { key: 'uniqueItems', label: 'Unique items', icon: Package, iconClass: 'bg-slate-100 text-slate-700' },
  { key: 'taken', label: 'Currently taken', icon: PackageOpen, iconClass: 'bg-orange-50 text-orange-700' },
  { key: 'available', label: 'Available', icon: PackageCheck, iconClass: 'bg-emerald-50 text-emerald-700' },
  { key: 'transactionsToday', label: 'Transactions today', icon: ScrollText, iconClass: 'bg-slate-100 text-slate-700' },
] as const;

export function DashboardStats() {
  const stats = useLiveQuery(() => getDashboardStats(), []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Loading summary">
        {CARDS.map((card) => (
          <div key={card.key} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className={`grid h-9 w-9 place-items-center rounded-xl ${card.iconClass}`}>
              <Icon size={18} />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {stats[card.key as keyof Stats]}
            </p>
            <p className="mt-1 text-sm text-slate-500">{card.label}</p>
          </article>
        );
      })}
    </div>
  );
}
