import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccess } from '../../components/AccessProvider';
import { LoadingState } from '../../components/EmptyState';
import { useAuditLog, useDirectory } from '../../services/useDirectory';
import { useDateTransactions, useTakenItems } from '../../services/useLogisticsData';
import { formatDateTime, todayKey } from '../../utils/dateUtils';

export default function AdminHome() {
  const access = useAccess();
  const directory = useDirectory();
  const audit = useAuditLog();
  const today = todayKey();
  const transactions = useDateTransactions(today, today);
  const taken = useTakenItems();
  const users = directory.users ?? [];
  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.status === 'ACTIVE').length,
    suspended: users.filter((user) => user.status === 'SUSPENDED').length,
    pending: users.filter((user) => user.status === 'PENDING_APPROVAL').length,
  }), [users]);
  const maxStatus = Math.max(counts.active, counts.suspended, counts.pending, 1);

  return (
    <div className="space-y-5">
      {directory.loading ? <LoadingState label="Loading accounts" /> : null}
      {directory.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{directory.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Registered users" value={directory.users ? counts.total : '…'} />
        <Stat label="Active users" value={directory.users ? counts.active : '…'} />
        <Stat label="Suspended" value={directory.users ? counts.suspended : '…'} />
        <Stat label="Pending approval" value={directory.users ? counts.pending : '…'} />
        <Stat label="Transactions today" value={transactions.data ? transactions.data.length : '…'} />
        <Stat label="Currently taken" value={taken.data ? taken.data.length : '…'} />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Account status</h2>
        <ul className="mt-4 space-y-3">
          {(['active', 'suspended', 'pending'] as const).map((key) => (
            <li key={key}>
              <div className="mb-1 flex justify-between text-sm text-slate-600">
                <span>{key === 'active' ? 'Active' : key === 'suspended' ? 'Suspended' : 'Pending'}</span>
                <span>{counts[key]}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${key === 'active' ? 'bg-emerald-600' : key === 'suspended' ? 'bg-amber-500' : 'bg-[#004f9f]'}`}
                  style={{ width: `${Math.round((counts[key] / maxStatus) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Recent activity</h2>
          {access.can('viewActivity') ? <Link to="/admin/activity" className="text-sm font-semibold text-slate-700">View log</Link> : null}
        </div>
        {audit.loading ? <LoadingState label="Loading activity" /> : null}
        {audit.error ? <p className="mt-3 text-sm text-red-700">{audit.error}</p> : null}
        <ul className="mt-3 divide-y divide-slate-100">
          {(audit.entries ?? []).slice(0, 6).map((entry) => (
            <li key={entry.id} className="py-3">
              <p className="text-sm font-medium text-slate-900">{entry.userName || entry.userEmail}</p>
              <p className="text-sm text-slate-600">{entry.description}</p>
              <p className="mt-1 text-xs text-slate-500">{entry.timestamp ? formatDateTime(entry.timestamp) : 'Pending time'} · {entry.action.replace(/_/g, ' ').toLowerCase()}</p>
            </li>
          ))}
        </ul>
        {audit.entries && audit.entries.length === 0 ? <p className="mt-3 text-sm text-slate-500">No activity has been recorded yet.</p> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
