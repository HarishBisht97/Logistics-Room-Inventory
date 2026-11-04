import { useAccess } from '../../components/AccessProvider';
import { LoadingState } from '../../components/EmptyState';
import { secondaryButton } from '../../components/styles';
import { changeUserStatus, revokeInvitation } from '../../services/accountService';
import { useDirectory, useInvitations } from '../../services/useDirectory';
import { formatDateTime } from '../../utils/dateUtils';
import { useConfirmAction } from './confirmAction';
import { RoleBadge, StatusBadge } from './status';

export default function Approvals() {
  const access = useAccess();
  const directory = useDirectory();
  const invitations = useInvitations();
  const { ask, dialog } = useConfirmAction();
  const actor = access.profile;
  const pending = (directory.users ?? []).filter((user) => user.status === 'PENDING_APPROVAL');
  const waiting = (invitations.invitations ?? []).filter((invitation) => invitation.status === 'INVITED');

  return (
    <div className="space-y-5">
      {dialog}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Waiting for approval</h2>
        {directory.loading ? <LoadingState label="Loading requests" /> : null}
        {directory.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{directory.error}</p> : null}
        {pending.length === 0 && directory.users ? <p className="text-sm text-slate-500">No accounts are waiting for approval.</p> : null}
        <ul className="space-y-3">
          {pending.map((user) => (
            <li key={user.uid} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{user.name}</p>
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">{user.email}</p>
              {actor && !user.protected && user.uid !== actor.uid ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => ask({
                      title: `Approve ${user.name}?`,
                      description: 'They will be able to use the features allowed for their role.',
                      confirmLabel: 'Approve',
                      tone: 'neutral',
                      success: 'Account approved.',
                      run: () => changeUserStatus(actor, user, 'ACTIVE'),
                    })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => ask({
                      title: `Reject ${user.name}?`,
                      description: 'They will remain signed in to Firebase, but the logbook will stay closed.',
                      confirmLabel: 'Reject',
                      success: 'Request rejected.',
                      run: () => changeUserStatus(actor, user, 'REJECTED'),
                    })}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Invitations not yet accepted</h2>
        <p className="text-sm leading-6 text-slate-500">
          An invitation does not send email from this app. The person must create a password account with the invited email. Firebase Authentication cannot be used to delete that password account from the browser.
        </p>
        {invitations.loading ? <LoadingState label="Loading invitations" /> : null}
        {waiting.length === 0 && invitations.invitations ? <p className="text-sm text-slate-500">No open invitations.</p> : null}
        <ul className="space-y-3">
          {waiting.map((invitation) => (
            <li key={invitation.email} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-medium text-slate-900">{invitation.name}</p>
              <p className="text-sm text-slate-500">{invitation.email} · {invitation.role === 'ADMIN' ? 'Admin' : 'Regular user'}</p>
              <p className="mt-1 text-xs text-slate-500">{invitation.invitedAt ? formatDateTime(invitation.invitedAt) : 'Invitation time pending'}</p>
              {actor ? (
                <button
                  type="button"
                  className={`${secondaryButton} mt-3`}
                  onClick={() => ask({
                    title: `Revoke ${invitation.email}?`,
                    description: 'They will not receive a profile from this invitation. If they already created an account, reject that account from the list above.',
                    confirmLabel: 'Revoke invitation',
                    success: 'Invitation revoked.',
                    run: () => revokeInvitation(actor, invitation),
                  })}
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
