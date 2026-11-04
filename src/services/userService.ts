import { type User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase/firebase';
import type { AccountStatus, UserProfile, UserRole } from '../types';
import { explainFirestoreError, timestampToIso } from './firestoreRecords';

let stagedName: string | null = null;

export function stageDisplayName(name: string): void {
  stagedName = name.trim();
}

export function stagedDisplayName(): string | null {
  return stagedName;
}

export function clearStagedDisplayName(): void {
  stagedName = null;
}

function cleanName(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function accountName(user: User, nameHint?: string | null): string {
  const hinted = cleanName(nameHint);
  if (hinted) return hinted;
  const display = cleanName(user.displayName);
  if (display) return display;
  const local = cleanName(user.email?.split('@')[0] ?? '');
  if (local) return local;
  return 'Staff';
}

function asAccountError(error: unknown, denied = 'You do not have permission to change this account.'): Error {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') return new Error(denied);
    if (error.code === 'unavailable') return new Error('You appear to be offline. Reconnect and try again.');
  }
  return new Error(explainFirestoreError(error));
}

export function profileFromDoc(id: string, data: DocumentData | undefined): UserProfile | null {
  if (!data) return null;
  if (data.role !== 'ADMIN' && data.role !== 'USER') return null;
  if (data.status !== 'PENDING' && data.status !== 'APPROVED' && data.status !== 'REJECTED' && data.status !== 'REVOKED') return null;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Staff';
  return {
    uid: typeof data.uid === 'string' && data.uid ? data.uid : id,
    name,
    email: typeof data.email === 'string' ? data.email : '',
    role: data.role,
    status: data.status,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

/**
 * Creates a pending regular-user profile when this Firebase account has none.
 * An existing document, including a console-provisioned admin, is left unchanged.
 */
export async function ensureUserProfile(user: User, nameHint?: string | null): Promise<void> {
  const email = user.email ?? '';
  if (email.trim().length === 0) throw new Error('This account has no email address.');
  const ref = doc(getFirestoreDb(), 'users', user.uid);
  try {
    await runTransaction(getFirestoreDb(), async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) return;
      transaction.set(ref, {
        uid: user.uid,
        name: accountName(user, nameHint),
        email,
        role: 'USER' satisfies UserRole,
        status: 'PENDING' satisfies AccountStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw asAccountError(error, 'Could not save your account profile. Deploy the latest Firestore rules, then sign in again.');
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(doc(getFirestoreDb(), 'users', uid), (snapshot) => {
    if (!snapshot.exists()) {
      if (snapshot.metadata.fromCache) return;
      onData(null);
      return;
    }
    const profile = profileFromDoc(snapshot.id, snapshot.data());
    if (!profile) {
      onError(new Error('This account profile is missing a role or status.'));
      return;
    }
    onData(profile);
  }, (error) => onError(asAccountError(error)));
}

export function subscribeUsers(
  onData: (users: UserProfile[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const usersQuery = query(collection(getFirestoreDb(), 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(usersQuery, (snapshot) => {
    const rows: UserProfile[] = [];
    for (const item of snapshot.docs) {
      const profile = profileFromDoc(item.id, item.data());
      if (profile) rows.push(profile);
    }
    onData(rows);
  }, (error) => onError(asAccountError(error)));
}

async function updateAccount(uid: string, actorUid: string, patch: { status?: AccountStatus; role?: UserRole }): Promise<void> {
  if (!actorUid || uid === actorUid) throw new Error('You cannot change your own account.');
  try {
    await updateDoc(doc(getFirestoreDb(), 'users', uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw asAccountError(error);
  }
}

export function approveUser(uid: string, actorUid: string): Promise<void> {
  return updateAccount(uid, actorUid, { status: 'APPROVED' });
}

export function rejectUser(uid: string, actorUid: string): Promise<void> {
  return updateAccount(uid, actorUid, { status: 'REJECTED' });
}

export function revokeUser(uid: string, actorUid: string): Promise<void> {
  return updateAccount(uid, actorUid, { status: 'REVOKED' });
}

export function restoreUser(uid: string, actorUid: string): Promise<void> {
  return updateAccount(uid, actorUid, { status: 'APPROVED' });
}

export function setUserRole(uid: string, actorUid: string, role: UserRole): Promise<void> {
  return updateAccount(uid, actorUid, { role });
}
