import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase/firebase';
import type {
  AccountStatus,
  AppSettings,
  AssignableRole,
  AuditEntry,
  Invitation,
  PermissionMap,
  UserProfile,
  UserRole,
} from '../types/access';
import { timestampToIso, explainFirestoreError } from './firestoreRecords';
import {
  adminPermissions,
  defaultSettings,
  normalizeEmail,
  permissionsForRole,
  sanitizeFeatures,
  sanitizePermissions,
  superAdminPermissions,
  userPermissions,
} from './accessModel';

const ensures = new Map<string, Promise<void>>();

export function watchOwnProfile(uid: string, onData: (profile: UserProfile | null) => void, onError: (message: string) => void): Unsubscribe {
  return onSnapshot(doc(getFirestoreDb(), 'users', uid), (snapshot) => {
    onData(snapshot.exists() ? profileFromData(uid, snapshot.data()) : null);
  }, (error) => onError(explainFirestoreError(error)));
}

export function watchSettings(onData: (settings: AppSettings) => void, onError: (message: string) => void): Unsubscribe {
  return onSnapshot(doc(getFirestoreDb(), 'appSettings', 'config'), (snapshot) => {
    onData(snapshot.exists() ? settingsFromData(snapshot.data()) : defaultSettings());
  }, (error) => onError(explainFirestoreError(error)));
}

export function watchUsers(onData: (users: UserProfile[]) => void, onError: (message: string) => void): Unsubscribe {
  return onSnapshot(collection(getFirestoreDb(), 'users'), (snapshot) => {
    onData(snapshot.docs.map((item) => profileFromData(item.id, item.data())));
  }, (error) => onError(explainFirestoreError(error)));
}

export function watchInvitations(onData: (invitations: Invitation[]) => void, onError: (message: string) => void): Unsubscribe {
  return onSnapshot(collection(getFirestoreDb(), 'invitations'), (snapshot) => {
    onData(snapshot.docs.flatMap((item) => {
      const invitation = invitationFromData(item.id, item.data());
      return invitation ? [invitation] : [];
    }));
  }, (error) => onError(explainFirestoreError(error)));
}

export function watchAuditLog(onData: (entries: AuditEntry[]) => void, onError: (message: string) => void): Unsubscribe {
  const auditQuery = query(collection(getFirestoreDb(), 'auditLogs'), orderBy('timestamp', 'desc'), limit(300));
  return onSnapshot(auditQuery, (snapshot) => {
    onData(snapshot.docs.flatMap((item) => {
      const entry = auditFromData(item.id, item.data());
      return entry ? [entry] : [];
    }));
  }, (error) => onError(explainFirestoreError(error)));
}

export function ensureOwnProfile(user: { uid: string; email: string | null }): Promise<void> {
  const existing = ensures.get(user.uid);
  if (existing) return existing;
  const task = createOwnProfile(user).finally(() => {
    ensures.delete(user.uid);
  });
  ensures.set(user.uid, task);
  return task;
}

export async function touchActivity(uid: string): Promise<void> {
  await updateDoc(doc(getFirestoreDb(), 'users', uid), {
    lastLoginAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  });
}

export async function renameSelf(uid: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error('Enter a name of 80 characters or fewer.');
  await updateDoc(doc(getFirestoreDb(), 'users', uid), { name: trimmed });
}

export async function writeAudit(
  actor: Pick<UserProfile, 'uid' | 'name' | 'email'>,
  action: string,
  description: string,
  targetId: string | null,
  metadata: Record<string, string> = {},
): Promise<void> {
  const text = description.trim();
  if (!text) return;
  await setDoc(doc(collection(getFirestoreDb(), 'auditLogs')), auditFields(actor, action, text, targetId, metadata));
}

export async function inviteUser(
  actor: UserProfile,
  input: { name: string; email: string; role: AssignableRole },
): Promise<void> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email.includes('@') || email.length > 320) throw new Error('Enter a valid email address.');
  if (!name || name.length > 80) throw new Error('Enter the person’s name.');
  if (email === normalizeEmail(actor.email)) throw new Error('You cannot invite your own email.');
  if (actor.role !== 'SUPER_ADMIN' && input.role !== 'USER') {
    throw new Error('Only a super admin can invite an admin.');
  }
  const database = getFirestoreDb();
  const existing = await getDoc(doc(database, 'invitations', email));
  if (existing.exists() && existing.data()?.status === 'INVITED') {
    throw new Error('That email already has an open invitation.');
  }
  const batch = writeBatch(database);
  batch.set(doc(database, 'invitations', email), {
    email,
    name,
    role: input.role,
    status: 'INVITED',
    invitedBy: actor.uid,
    invitedAt: serverTimestamp(),
  });
  batch.set(doc(collection(database, 'auditLogs')), auditFields(
    actor,
    'USER_INVITED',
    `Invited ${name} (${email}) as ${input.role === 'ADMIN' ? 'an admin' : 'a regular user'}.`,
    email,
    { email, role: input.role },
  ));
  try {
    await batch.commit();
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

export async function revokeInvitation(actor: UserProfile, invitation: Invitation): Promise<void> {
  const database = getFirestoreDb();
  const batch = writeBatch(database);
  batch.update(doc(database, 'invitations', invitation.email), { status: 'REVOKED' });
  batch.set(doc(collection(database, 'auditLogs')), auditFields(
    actor,
    'USER_INVITED',
    `Revoked the invitation for ${invitation.email}.`,
    invitation.email,
    { email: invitation.email },
  ));
  try {
    await batch.commit();
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

export async function changeUserStatus(actor: UserProfile, target: UserProfile, status: AccountStatus): Promise<void> {
  assertCanManage(actor, target);
  const change = describeStatusChange(target.status, status);
  const database = getFirestoreDb();
  const batch = writeBatch(database);
  batch.update(doc(database, 'users', target.uid), { status });
  batch.set(doc(collection(database, 'auditLogs')), auditFields(
    actor,
    change.action,
    `${change.verb} ${target.name} (${target.email}).`,
    target.uid,
    { email: target.email, status },
  ));
  try {
    await batch.commit();
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

export async function changeUserRole(actor: UserProfile, target: UserProfile, role: UserRole): Promise<void> {
  assertCanManage(actor, target);
  if (actor.role !== 'SUPER_ADMIN') throw new Error('Only a super admin can change roles.');
  const database = getFirestoreDb();
  const batch = writeBatch(database);
  batch.update(doc(database, 'users', target.uid), {
    role,
    permissions: permissionsForRole(role),
  });
  batch.set(doc(collection(database, 'auditLogs')), auditFields(
    actor,
    'ROLE_CHANGED',
    `Changed ${target.name} from ${target.role} to ${role}.`,
    target.uid,
    { email: target.email, role },
  ));
  try {
    await batch.commit();
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

export async function changeUserPermissions(actor: UserProfile, target: UserProfile, permissions: PermissionMap): Promise<void> {
  assertCanManage(actor, target);
  if (actor.role !== 'SUPER_ADMIN') throw new Error('Only a super admin can change permissions.');
  if (target.role === 'SUPER_ADMIN') throw new Error('Super admin access is not controlled by permission toggles.');
  const database = getFirestoreDb();
  const batch = writeBatch(database);
  batch.update(doc(database, 'users', target.uid), { permissions });
  batch.set(doc(collection(database, 'auditLogs')), auditFields(
    actor,
    'PERMISSIONS_CHANGED',
    `Updated permissions for ${target.name}.`,
    target.uid,
    { email: target.email },
  ));
  try {
    await batch.commit();
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

export async function saveSettings(actor: UserProfile, settings: AppSettings): Promise<void> {
  if (actor.role !== 'SUPER_ADMIN' || actor.status !== 'ACTIVE') {
    throw new Error('Only a super admin can change application settings.');
  }
  const name = settings.applicationName.trim();
  const institution = settings.institutionName.trim();
  const logoUrl = settings.logoUrl.trim();
  if (!name || name.length > 80) throw new Error('Enter an application name of 80 characters or fewer.');
  if (!institution || institution.length > 120) throw new Error('Enter an institution name of 120 characters or fewer.');
  if (logoUrl && !/^https:\/\/.{1,480}$/.test(logoUrl)) throw new Error('The logo must be an https link, or left blank to use the IIT Bombay seal.');
  try {
    await setDoc(doc(getFirestoreDb(), 'appSettings', 'config'), {
      applicationName: name,
      institutionName: institution,
      logoUrl,
      registrationEnabled: settings.registrationEnabled,
      approvalRequired: settings.approvalRequired,
      defaultRole: 'USER',
      transactionEditingEnabled: settings.transactionEditingEnabled,
      features: settings.features,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    await writeAudit(actor, 'SETTINGS_CHANGED', 'Updated application settings.', 'appSettings/config', {
      applicationName: name,
    });
  } catch (error) {
    throw new Error(explainFirestoreError(error));
  }
}

async function createOwnProfile(user: { uid: string; email: string | null }): Promise<void> {
  const email = user.email ? normalizeEmail(user.email) : '';
  if (!email) throw new Error('This account has no email address.');
  const database = getFirestoreDb();
  const profileRef = doc(database, 'users', user.uid);
  const existing = await getDoc(profileRef);
  if (existing.exists()) return;

  const [invitationSnap, settingsSnap] = await Promise.all([
    getDoc(doc(database, 'invitations', email)),
    getDoc(doc(database, 'appSettings', 'config')),
  ]);
  const settings = settingsSnap.exists() ? settingsFromData(settingsSnap.data()) : defaultSettings();
  const invitation = invitationSnap.exists() ? invitationFromData(email, invitationSnap.data()) : null;
  const base = {
    uid: user.uid,
    email,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  };

  try {
    if (invitation && invitation.status === 'INVITED') {
      await setDoc(profileRef, {
        ...base,
        name: invitation.name,
        role: invitation.role,
        status: settings.approvalRequired ? 'PENDING_APPROVAL' : 'ACTIVE',
        permissions: invitation.role === 'ADMIN' ? adminPermissions() : userPermissions(),
        protected: false,
      });
      return;
    }
    if (settings.registrationEnabled) {
      const localName = email.split('@')[0]?.slice(0, 80) || 'Staff member';
      await setDoc(profileRef, {
        ...base,
        name: localName,
        role: 'USER',
        status: settings.approvalRequired ? 'PENDING_APPROVAL' : 'ACTIVE',
        permissions: userPermissions(),
        protected: false,
      });
      return;
    }
    await setDoc(profileRef, {
      ...base,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      permissions: superAdminPermissions(),
      protected: true,
    });
  } catch (error) {
    const message = explainFirestoreError(error);
    if (message.toLowerCase().includes('permission')) {
      throw new Error('This email has not been invited. Ask a super admin to send an invitation, then open the app again.');
    }
    throw new Error(message);
  }
}

function assertCanManage(actor: UserProfile, target: UserProfile): void {
  if (actor.status !== 'ACTIVE') throw new Error('Your account cannot manage users.');
  if (actor.uid === target.uid) throw new Error('You cannot change your own access.');
  if (target.protected) throw new Error('This super admin account is protected and cannot be changed.');
  if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw new Error('Only a super admin can change another super admin.');
  }
  if (actor.role === 'ADMIN' && target.role !== 'USER') {
    throw new Error('Admins can manage regular users only.');
  }
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
    throw new Error('You cannot manage users.');
  }
}

function auditFields(
  actor: Pick<UserProfile, 'uid' | 'name' | 'email'>,
  action: string,
  description: string,
  targetId: string | null,
  metadata: Record<string, string>,
) {
  return {
    userId: actor.uid,
    userName: actor.name,
    userEmail: actor.email,
    action,
    description: description.slice(0, 500),
    targetId,
    timestamp: serverTimestamp(),
    metadata,
  };
}

function describeStatusChange(previous: AccountStatus, status: AccountStatus): { action: string; verb: string } {
  if (status === 'ACTIVE' && previous === 'SUSPENDED') return { action: 'USER_REACTIVATED', verb: 'Reactivated' };
  if (status === 'ACTIVE') return { action: 'USER_APPROVED', verb: 'Approved' };
  if (status === 'SUSPENDED') return { action: 'USER_SUSPENDED', verb: 'Suspended' };
  if (status === 'REJECTED') return { action: 'USER_REJECTED', verb: 'Rejected' };
  if (status === 'REMOVED') return { action: 'USER_REMOVED', verb: 'Removed' };
  return { action: 'USER_INVITED', verb: 'Updated' };
}

function profileFromData(uid: string, data: Record<string, unknown>): UserProfile {
  const role: UserRole = data.role === 'SUPER_ADMIN' || data.role === 'ADMIN' ? data.role : 'USER';
  const status = accountStatus(data.status);
  return {
    uid,
    name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Staff member',
    email: typeof data.email === 'string' ? data.email : '',
    role,
    status,
    permissions: sanitizePermissions(data.permissions as Partial<PermissionMap> | undefined, permissionsForRole(role)),
    createdAt: timestampToIso(data.createdAt),
    lastLoginAt: timestampToIso(data.lastLoginAt),
    lastActiveAt: timestampToIso(data.lastActiveAt),
    protected: data.protected === true,
  };
}

function accountStatus(value: unknown): AccountStatus {
  if (value === 'INVITED' || value === 'PENDING_APPROVAL' || value === 'ACTIVE' || value === 'SUSPENDED' || value === 'REJECTED' || value === 'REMOVED') {
    return value;
  }
  return 'PENDING_APPROVAL';
}

function invitationFromData(id: string, data: Record<string, unknown> | undefined): Invitation | null {
  if (!data || (data.role !== 'ADMIN' && data.role !== 'USER')) return null;
  return {
    email: typeof data.email === 'string' ? data.email : id,
    name: typeof data.name === 'string' ? data.name : '',
    role: data.role,
    status: data.status === 'REVOKED' ? 'REVOKED' : 'INVITED',
    invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : '',
    invitedAt: timestampToIso(data.invitedAt),
  };
}

function settingsFromData(data: Record<string, unknown>): AppSettings {
  const defaults = defaultSettings();
  return {
    applicationName: typeof data.applicationName === 'string' && data.applicationName.trim() ? data.applicationName : defaults.applicationName,
    institutionName: typeof data.institutionName === 'string' && data.institutionName.trim() ? data.institutionName : defaults.institutionName,
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : '',
    registrationEnabled: data.registrationEnabled === true,
    approvalRequired: data.approvalRequired !== false,
    defaultRole: 'USER',
    transactionEditingEnabled: data.transactionEditingEnabled === true,
    features: sanitizeFeatures(data.features as Partial<AppSettings['features']> | undefined),
    updatedAt: timestampToIso(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  };
}

function auditFromData(id: string, data: Record<string, unknown>): AuditEntry | null {
  if (typeof data.userId !== 'string' || typeof data.action !== 'string') return null;
  const metadata: Record<string, string> = {};
  if (data.metadata && typeof data.metadata === 'object') {
    for (const [key, value] of Object.entries(data.metadata as Record<string, unknown>)) {
      if (typeof value === 'string') metadata[key] = value;
    }
  }
  return {
    id,
    userId: data.userId,
    userName: typeof data.userName === 'string' ? data.userName : '',
    userEmail: typeof data.userEmail === 'string' ? data.userEmail : '',
    action: data.action,
    description: typeof data.description === 'string' ? data.description : '',
    targetId: typeof data.targetId === 'string' ? data.targetId : null,
    timestamp: timestampToIso(data.timestamp),
    metadata,
  };
}
