import type { TransactionAction } from '../types';
import { actionLabel } from '../utils/labels';

export function ActionBadge({ action }: { action: TransactionAction }) {
  const taking = action === 'TAKING';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        taking
          ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200'
          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      }`}
    >
      {actionLabel(action)}
    </span>
  );
}
