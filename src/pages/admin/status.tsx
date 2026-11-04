import type { AccountStatus, UserRole } from '../../types/access';

const STATUS_LABELS: Record<AccountStatus, string> = {
  INVITED: 'Invited',
  PENDING_APPROVAL: 'Pending',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
  REMOVED: 'Removed',
};

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMIN: 'Admin',
  USER: 'User',
};

export function statusLabel(status: AccountStatus): string {
  return STATUS_LABELS[status];
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  const tone = status === 'ACTIVE'
    ? 'bg-emerald-50 text-emerald-800'
    : status === 'SUSPENDED' || status === 'PENDING_APPROVAL'
      ? 'bg-amber-50 text-amber-800'
      : status === 'REJECTED' || status === 'REMOVED'
        ? 'bg-red-50 text-red-700'
        : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{STATUS_LABELS[status]}</span>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  const tone = role === 'SUPER_ADMIN' ? 'bg-[#004f9f] text-white' : role === 'ADMIN' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{ROLE_LABELS[role]}</span>;
}
