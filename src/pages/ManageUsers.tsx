import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAuth } from '../components/AuthGate';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { focusRing } from '../components/styles';
import { useToast } from '../components/ToastProvider';
import { approveUser, rejectUser, restoreUser, revokeUser, setUserRole, subscribeUsers } from '../services/userService';
import type { AccountStatus, UserProfile, UserRole } from '../types';
import { formatDate } from '../utils/dateUtils';

type UserFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'revoked' | 'admins' | 'users';

interface FilterOption {
  id: UserFilter;
  label: string;
}

const FILTERS: FilterOption[] = [
  { id: 'all', label: 'All Users' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'revoked', label: 'Revoked' },
  { id: 'admins', label: 'Admins' },
  { id: 'users', label: 'Regular Users' },
];

type AccountAction =
  | { kind: 'reject'; person: UserProfile }
  | { kind: 'revoke'; person: UserProfile }
  | { kind: 'restore'; person: UserProfile }
  | { kind: 'promote'; person: UserProfile }
  | { kind: 'demote'; person: UserProfile };

export default function ManageUsers() {
  const { isAdmin, uid } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [action, setAction] = useState<AccountAction | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!isAdmin) return undefined;
    return subscribeUsers((rows) => {
      setUsers(rows);
      setError('');
    }, (next) => setError(next.message));
  }, [isAdmin]);

  const rows = useMemo(() => {
    const list = users ?? [];
    if (filter === 'pending') return list.filter((person) => person.status === 'PENDING');
    if (filter === 'approved') return list.filter((person) => person.status === 'APPROVED');
    if (filter === 'rejected') return list.filter((person) => person.status === 'REJECTED');
    if (filter === 'revoked') return list.filter((person) => person.status === 'REVOKED');
    if (filter === 'admins') return list.filter((person) => person.role === 'ADMIN');
    if (filter === 'users') return list.filter((person) => person.role === 'USER');
    return list;
  }, [filter, users]);

  const pendingCount = (users ?? []).filter((person) => person.status === 'PENDING').length;

  async function run(task: () => Promise<void>, success: string) {
    if (busyRef.current || !uid) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
      toast.success(success);
      setAction(null);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update that account.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function approve(person: UserProfile) {
    if (!uid || person.uid === uid || person.status !== 'PENDING') return;
    void run(() => approveUser(person.uid, uid), `${person.name} can now open the logbook.`);
  }

  function confirmAction() {
    if (!action || !uid || action.person.uid === uid) return;
    if (action.kind === 'reject') {
      void run(() => rejectUser(action.person.uid, uid), `${action.person.name} was rejected.`);
      return;
    }
    if (action.kind === 'revoke') {
      void run(() => revokeUser(action.person.uid, uid), `${action.person.name} can no longer open the logbook.`);
      return;
    }
    if (action.kind === 'restore') {
      void run(() => restoreUser(action.person.uid, uid), `${action.person.name} can open the logbook again.`);
      return;
    }
    const role: UserRole = action.kind === 'promote' ? 'ADMIN' : 'USER';
    const success = role === 'ADMIN'
      ? `${action.person.name} can now manage users.`
      : `${action.person.name} is now a regular user.`;
    void run(() => setUserRole(action.person.uid, uid, role), success);
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const dialog = action ? dialogCopy(action) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manage Users"
        description="Approve new staff, revoke access, and choose who can manage users."
      />
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      {users ? (
        <>
          <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900" role="status">
            {pendingCount} pending approval {pendingCount === 1 ? 'request' : 'requests'}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter users">
            {FILTERS.map((option) => {
              const selected = filter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(option.id)}
                  className={`min-h-10 rounded-full px-3 text-sm font-semibold ${focusRing} ${
                    selected ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={users.length === 0 ? 'No staff accounts yet' : 'No accounts in this filter'}
              description={users.length === 0
                ? 'New staff appear here after they create an account.'
                : 'Try another filter to see more accounts.'}
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rows.map((person) => (
                  <article key={person.uid} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h2 className="text-base font-semibold text-slate-900">
                      {person.name}
                      {person.uid === uid ? <span className="ml-2 text-xs font-medium text-slate-500">You</span> : null}
                    </h2>
                    <p className="mt-1 break-all text-sm text-slate-500">{person.email}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-500">Role</dt>
                        <dd className="mt-1"><RoleBadge role={person.role} /></dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Account Status</dt>
                        <dd className="mt-1"><StatusBadge status={person.status} /></dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-slate-500">Date Joined</dt>
                        <dd className="mt-1 text-slate-800">{joinedOn(person.createdAt)}</dd>
                      </div>
                    </dl>
                    <div className="mt-4">
                      <AccountActions
                        person={person}
                        currentUid={uid}
                        busy={busy}
                        stacked
                        onApprove={approve}
                        onReject={(next) => setAction({ kind: 'reject', person: next })}
                        onRevoke={(next) => setAction({ kind: 'revoke', person: next })}
                        onRestore={(next) => setAction({ kind: 'restore', person: next })}
                        onPromote={(next) => setAction({ kind: 'promote', person: next })}
                        onDemote={(next) => setAction({ kind: 'demote', person: next })}
                      />
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <caption className="sr-only">Registered users</caption>
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th scope="col" className="px-4 py-3">Name</th>
                      <th scope="col" className="px-4 py-3">Email</th>
                      <th scope="col" className="px-4 py-3">Role</th>
                      <th scope="col" className="px-4 py-3">Account Status</th>
                      <th scope="col" className="px-4 py-3">Date Joined</th>
                      <th scope="col" className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((person) => (
                      <tr key={person.uid} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {person.name}
                          {person.uid === uid ? <span className="ml-2 text-xs font-medium text-slate-500">You</span> : null}
                        </td>
                        <td className="max-w-56 truncate px-4 py-3 text-slate-600" title={person.email}>{person.email}</td>
                        <td className="px-4 py-3"><RoleBadge role={person.role} /></td>
                        <td className="px-4 py-3"><StatusBadge status={person.status} /></td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{joinedOn(person.createdAt)}</td>
                        <td className="px-4 py-3">
                          <AccountActions
                            person={person}
                            currentUid={uid}
                            busy={busy}
                            onApprove={approve}
                            onReject={(next) => setAction({ kind: 'reject', person: next })}
                            onRevoke={(next) => setAction({ kind: 'revoke', person: next })}
                            onRestore={(next) => setAction({ kind: 'restore', person: next })}
                            onPromote={(next) => setAction({ kind: 'promote', person: next })}
                            onDemote={(next) => setAction({ kind: 'demote', person: next })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : error ? null : <LoadingState label="Loading users" />}
      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ''}
        description={dialog?.description ?? ''}
        confirmLabel={dialog?.confirmLabel ?? 'Confirm'}
        cancelLabel="Cancel"
        busy={busy}
        busyLabel="Saving…"
        tone={dialog?.tone ?? 'danger'}
        onCancel={() => {
          if (!busy) setAction(null);
        }}
        onConfirm={confirmAction}
      />
    </div>
  );
}

function joinedOn(createdAt: string | null): string {
  return createdAt ? formatDate(createdAt) : '—';
}

function dialogCopy(action: AccountAction): { title: string; description: string; confirmLabel: string; tone: 'danger' | 'neutral' } {
  const name = action.person.name;
  if (action.kind === 'reject') {
    return {
      title: 'Reject this account?',
      description: `${name} will see a rejection message and will not be able to open the logbook.`,
      confirmLabel: 'Reject',
      tone: 'danger',
    };
  }
  if (action.kind === 'revoke') {
    return {
      title: 'Revoke access?',
      description: `${name} will be signed out of the logbook. Their past transactions stay. This does not delete their Firebase sign-in account.`,
      confirmLabel: 'Revoke access',
      tone: 'danger',
    };
  }
  if (action.kind === 'restore') {
    return {
      title: 'Restore access?',
      description: `${name} will be able to open the logbook again with the same role.`,
      confirmLabel: 'Restore access',
      tone: 'neutral',
    };
  }
  if (action.kind === 'promote') {
    return {
      title: 'Make this person an admin?',
      description: `${name} will be able to approve accounts and change roles. Admins have equal access.`,
      confirmLabel: 'Make Admin',
      tone: 'neutral',
    };
  }
  return {
    title: 'Remove admin access?',
    description: `${name} will stay approved and continue as a regular user.`,
    confirmLabel: 'Remove Admin',
    tone: 'danger',
  };
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const tone = status === 'PENDING'
    ? 'bg-orange-100 text-orange-800'
    : status === 'APPROVED'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'REVOKED'
        ? 'bg-slate-200 text-slate-700'
        : 'bg-red-100 text-red-800';
  const label = status === 'PENDING' ? 'Pending' : status === 'APPROVED' ? 'Approved' : status === 'REVOKED' ? 'Revoked' : 'Rejected';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function RoleBadge({ role }: { role: UserRole }) {
  const admin = role === 'ADMIN';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${admin ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
      {admin ? 'Admin' : 'Regular User'}
    </span>
  );
}

function AccountActions({
  person,
  currentUid,
  busy,
  stacked = false,
  onApprove,
  onReject,
  onRevoke,
  onRestore,
  onPromote,
  onDemote,
}: {
  person: UserProfile;
  currentUid: string | null;
  busy: boolean;
  stacked?: boolean;
  onApprove: (person: UserProfile) => void;
  onReject: (person: UserProfile) => void;
  onRevoke: (person: UserProfile) => void;
  onRestore: (person: UserProfile) => void;
  onPromote: (person: UserProfile) => void;
  onDemote: (person: UserProfile) => void;
}) {
  if (person.uid === currentUid) {
    return <p className={`text-sm text-slate-500 ${stacked ? '' : 'text-right'}`}>Your account</p>;
  }

  const layout = stacked ? 'flex flex-col gap-2' : 'flex flex-wrap justify-end gap-2';
  const width = stacked ? 'w-full' : '';

  if (person.status === 'PENDING') {
    return (
      <div className={layout}>
        <button type="button" className={`${actionButton} bg-emerald-600 text-white hover:bg-emerald-700 ${width}`} disabled={busy} onClick={() => onApprove(person)}>
          Approve
        </button>
        <button type="button" className={`${actionButton} bg-red-600 text-white hover:bg-red-700 ${width}`} disabled={busy} onClick={() => onReject(person)}>
          Reject
        </button>
      </div>
    );
  }

  if (person.status === 'REVOKED') {
    return (
      <div className={layout}>
        <button type="button" className={`${actionButton} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 ${width}`} disabled={busy} onClick={() => onRestore(person)}>
          Restore access
        </button>
      </div>
    );
  }

  if (person.status === 'APPROVED' && person.role === 'USER') {
    return (
      <div className={layout}>
        <button type="button" className={`${actionButton} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 ${width}`} disabled={busy} onClick={() => onPromote(person)}>
          Make Admin
        </button>
        <button type="button" className={`${actionButton} bg-red-600 text-white hover:bg-red-700 ${width}`} disabled={busy} onClick={() => onRevoke(person)}>
          Revoke access
        </button>
      </div>
    );
  }

  if (person.status === 'APPROVED' && person.role === 'ADMIN') {
    return (
      <div className={layout}>
        <button type="button" className={`${actionButton} border border-red-200 bg-white text-red-700 hover:bg-red-50 ${width}`} disabled={busy} onClick={() => onDemote(person)}>
          Remove Admin
        </button>
        <button type="button" className={`${actionButton} bg-red-600 text-white hover:bg-red-700 ${width}`} disabled={busy} onClick={() => onRevoke(person)}>
          Revoke access
        </button>
      </div>
    );
  }

  return <p className={`text-sm text-slate-400 ${stacked ? '' : 'text-right'}`}>—</p>;
}

const actionButton = `inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold disabled:opacity-60 ${focusRing}`;
