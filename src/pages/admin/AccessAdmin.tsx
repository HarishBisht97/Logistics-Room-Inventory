import { useState } from 'react';
import { useAccess } from '../../components/AccessProvider';
import { LoadingState } from '../../components/EmptyState';
import { secondaryButton } from '../../components/styles';
import { changeUserPermissions } from '../../services/accountService';
import { PERMISSION_LABELS } from '../../services/accessModel';
import { useDirectory } from '../../services/useDirectory';
import { PERMISSION_KEYS, type PermissionMap, type UserProfile } from '../../types/access';
import { useToast } from '../../components/ToastProvider';
import { RoleBadge } from './status';

export default function AccessAdmin() {
  const access = useAccess();
  const directory = useDirectory();
  const users = (directory.users ?? []).filter((user) => user.role !== 'SUPER_ADMIN');

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-500">
        These switches are stored on each person’s profile and checked by Firestore rules. Turning off Excel export hides the download and blocks it in the interface. Someone who can already read a record can still copy it from the screen. Super admin access is not a toggle.
      </p>
      {directory.loading ? <LoadingState label="Loading permissions" /> : null}
      {directory.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{directory.error}</p> : null}
      <ul className="space-y-3">
        {users.map((user) => (
          <li key={user.uid}>
            <PermissionCard
              key={`${user.uid}:${PERMISSION_KEYS.map((key) => (user.permissions[key] ? '1' : '0')).join('')}`}
              user={user}
              editable={access.isSuperAdmin && user.uid !== access.uid}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PermissionCard({ user, editable }: { user: UserProfile; editable: boolean }) {
  const toast = useToast();
  const access = useAccess();
  const [permissions, setPermissions] = useState<PermissionMap>(user.permissions);
  const [busy, setBusy] = useState(false);
  const dirty = PERMISSION_KEYS.some((key) => permissions[key] !== user.permissions[key]);

  async function save() {
    if (!access.profile || busy) return;
    setBusy(true);
    try {
      await changeUserPermissions(access.profile, user, permissions);
      toast.success(`Updated permissions for ${user.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update permissions.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-slate-900">{user.name}</h2>
        <RoleBadge role={user.role} />
        <span className="text-sm text-slate-500">{user.email}</span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {PERMISSION_KEYS.map((key) => (
          <li key={key}>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={permissions[key]}
                disabled={!editable || busy}
                onChange={(event) => setPermissions((current) => ({ ...current, [key]: event.target.checked }))}
              />
              {PERMISSION_LABELS[key]}
            </label>
          </li>
        ))}
      </ul>
      {editable ? (
        <button type="button" className={`${secondaryButton} mt-4`} disabled={!dirty || busy} onClick={() => void save()}>
          Save permissions
        </button>
      ) : <p className="mt-3 text-sm text-slate-500">Only a super admin can change these permissions.</p>}
    </article>
  );
}
