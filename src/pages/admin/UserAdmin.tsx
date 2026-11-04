import { useEffect, useMemo, useState } from 'react';
import { useAccess } from '../../components/AccessProvider';
import { LoadingState } from '../../components/EmptyState';
import { SearchField } from '../../components/SearchField';
import { secondaryButton, textInput } from '../../components/styles';
import { changeUserRole, changeUserStatus, inviteUser } from '../../services/accountService';
import { getAllTransactions } from '../../services/transactionService';
import { useDirectory } from '../../services/useDirectory';
import type { AccountStatus, UserProfile, UserRole } from '../../types/access';
import { formatDateTime } from '../../utils/dateUtils';
import { useConfirmAction } from './confirmAction';
import { RoleBadge, StatusBadge, roleLabel } from './status';

export default function UserAdmin() {
  const access = useAccess();
  const directory = useDirectory();
  const { ask, dialog } = useConfirmAction();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'ALL' | UserRole>('ALL');
  const [status, setStatus] = useState<'ALL' | AccountStatus>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const actor = access.profile;
  const canCount = access.can('viewAllHistory');

  useEffect(() => {
    if (!canCount) return undefined;
    let active = true;
    getAllTransactions().then((rows) => {
      if (!active) return;
      const next: Record<string, number> = {};
      for (const row of rows) {
        if (!row.createdBy) continue;
        next[row.createdBy] = (next[row.createdBy] ?? 0) + 1;
      }
      setCounts(next);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [canCount]);

  const users = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (directory.users ?? []).filter((user) => {
      if (role !== 'ALL' && user.role !== role) return false;
      if (status !== 'ALL' && user.status !== status) return false;
      if (!needle) return true;
      return user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle);
    }).sort((left, right) => left.name.localeCompare(right.name));
  }, [directory.users, query, role, status]);
  const selected = users.find((user) => user.uid === selectedId) ?? directory.users?.find((user) => user.uid === selectedId) ?? null;

  function manage(user: UserProfile, nextStatus: AccountStatus, title: string, description: string, confirmLabel: string, success: string) {
    if (!actor) return;
    ask({
      title,
      description,
      confirmLabel,
      success,
      run: () => changeUserStatus(actor, user, nextStatus),
    });
  }

  return (
    <div className="space-y-4">
      {dialog}
      {actor && access.can('inviteUsers') ? <InviteForm actor={actor} superAdmin={access.isSuperAdmin} /> : null}
      <div className="grid gap-2 md:grid-cols-[1fr_10rem_12rem]">
        <SearchField value={query} onChange={setQuery} placeholder="Search name or email" />
        <select value={role} onChange={(event) => setRole(event.target.value as 'ALL' | UserRole)} className={textInput} aria-label="Filter by role">
          <option value="ALL">All roles</option>
          <option value="SUPER_ADMIN">Super admin</option>
          <option value="ADMIN">Admin</option>
          <option value="USER">User</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | AccountStatus)} className={textInput} aria-label="Filter by status">
          <option value="ALL">All statuses</option>
          <option value="PENDING_APPROVAL">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Rejected</option>
          <option value="REMOVED">Removed</option>
        </select>
      </div>
      {directory.loading ? <LoadingState label="Loading users" /> : null}
      {directory.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{directory.error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              <th className="px-3 py-3 font-medium">Last login</th>
              <th className="px-3 py-3 font-medium">Last active</th>
              <th className="px-3 py-3 font-medium">Transactions</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.uid} className="border-t border-slate-100 align-top">
                <td className="px-3 py-3 font-medium text-slate-900">{user.name}</td>
                <td className="px-3 py-3 text-slate-700">{user.email}</td>
                <td className="px-3 py-3"><RoleBadge role={user.role} /></td>
                <td className="px-3 py-3"><StatusBadge status={user.status} /></td>
                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{user.createdAt ? formatDateTime(user.createdAt) : '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{user.lastActiveAt ? formatDateTime(user.lastActiveAt) : '—'}</td>
                <td className="px-3 py-3 text-slate-700">{counts[user.uid] ?? '—'}</td>
                <td className="px-3 py-3">
                  <button type="button" className="text-sm font-semibold text-slate-800" onClick={() => setSelectedId(user.uid)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && directory.users ? <p className="px-3 py-6 text-sm text-slate-500">No users match that search.</p> : null}
      </div>
      {selected && actor ? (
        <UserDetail
          actor={actor}
          user={selected}
          count={counts[selected.uid] ?? 0}
          superAdmin={access.isSuperAdmin}
          onRole={(next) => {
            ask({
              title: `Change ${selected.name} to ${roleLabel(next)}?`,
              description: 'This replaces their current permission set with the default for that role. You cannot change your own role, and the protected super admin cannot be changed.',
              confirmLabel: 'Change role',
              tone: 'neutral',
              success: 'Role updated.',
              run: () => changeUserRole(actor, selected, next),
            });
          }}
          onSuspend={() => manage(selected, 'SUSPENDED', `Suspend ${selected.name}?`, 'They will be blocked from records and new transactions. Their existing history stays.', 'Suspend account', 'Account suspended.')}
          onReactivate={() => manage(selected, 'ACTIVE', `Reactivate ${selected.name}?`, 'Their role and saved permissions will apply again.', 'Reactivate account', 'Account reactivated.',)}
          onRemove={() => manage(selected, 'REMOVED', `Remove ${selected.name} from the logbook?`, 'This revokes Firestore access. It does not delete their Firebase sign-in account, and it keeps their transactions and activity history.', 'Remove access', 'Access removed.')}
        />
      ) : null}
    </div>
  );
}

function InviteForm({ actor, superAdmin }: { actor: UserProfile; superAdmin: boolean }) {
  const { ask, dialog } = useConfirmAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');

  return (
    <form
      className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_10rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const invitedName = name.trim();
        const invitedEmail = email.trim();
        ask({
          title: `Invite ${invitedEmail || 'this person'}?`,
          description: 'This stores an invitation in Firestore. The app cannot send a custom email without Cloud Functions. Ask them to create an account with this exact email. They stay pending until you approve them when approval is required.',
          confirmLabel: 'Save invitation',
          tone: 'neutral',
          success: 'Invitation saved. Share the app address with that email.',
          run: async () => {
            await inviteUser(actor, { name: invitedName, email: invitedEmail, role });
            setName('');
            setEmail('');
            setRole('USER');
          },
        });
      }}
    >
      {dialog}
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" aria-label="Invitee name" className={textInput} required />
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" aria-label="Invitee email" type="email" className={textInput} required />
      <select value={role} onChange={(event) => setRole(event.target.value === 'ADMIN' ? 'ADMIN' : 'USER')} className={textInput} aria-label="Invite role" disabled={!superAdmin}>
        <option value="USER">Regular user</option>
        {superAdmin ? <option value="ADMIN">Admin</option> : null}
      </select>
      <button type="submit" className={secondaryButton}>Invite</button>
    </form>
  );
}

function UserDetail({
  actor,
  user,
  count,
  superAdmin,
  onRole,
  onSuspend,
  onReactivate,
  onRemove,
}: {
  actor: UserProfile;
  user: UserProfile;
  count: number;
  superAdmin: boolean;
  onRole: (role: UserRole) => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onRemove: () => void;
}) {
  const locked = user.protected || user.uid === actor.uid || (!superAdmin && user.role !== 'USER');
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{user.name}</h2>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <RoleBadge role={user.role} />
          <StatusBadge status={user.status} />
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">Joined</dt><dd>{user.createdAt ? formatDateTime(user.createdAt) : '—'}</dd></div>
        <div><dt className="text-slate-500">Last login</dt><dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</dd></div>
        <div><dt className="text-slate-500">Transactions recorded</dt><dd>{count}</dd></div>
      </dl>
      {user.protected ? <p className="mt-3 text-sm text-slate-600">This is the protected super admin. The account cannot be suspended, removed, or demoted.</p> : null}
      {user.uid === actor.uid ? <p className="mt-3 text-sm text-slate-600">You cannot change your own role or status.</p> : null}
      {locked ? null : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {superAdmin ? (
            <label className="text-sm font-medium text-slate-700">
              Role
              <select
                className={`${textInput} mt-1`}
                value={user.role}
                onChange={(event) => {
                  const next = event.target.value;
                  if ((next === 'SUPER_ADMIN' || next === 'ADMIN' || next === 'USER') && next !== user.role) onRole(next);
                }}
              >
                <option value="USER">Regular user</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </select>
            </label>
          ) : null}
          {user.status === 'SUSPENDED' ? (
            <button type="button" className={secondaryButton} onClick={onReactivate}>Reactivate</button>
          ) : (
            <button type="button" className={secondaryButton} onClick={onSuspend}>Suspend</button>
          )}
          <button type="button" className={secondaryButton} onClick={onRemove}>Remove access</button>
        </div>
      )}
    </section>
  );
}
