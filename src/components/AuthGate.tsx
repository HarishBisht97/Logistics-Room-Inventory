import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase/firebase';
import {
  clearStagedDisplayName,
  ensureUserProfile,
  stageDisplayName,
  stagedDisplayName,
  subscribeUserProfile,
} from '../services/userService';
import type { UserProfile } from '../types';
import { AccountStatusScreen } from './AccountStatusScreen';
import { BrandMark } from './BrandMark';
import { SignInScreen } from './SignInScreen';

interface AuthState {
  configured: boolean;
  email: string | null;
  uid: string | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const localAuth: AuthState = {
  configured: false,
  email: null,
  uid: null,
  profile: null,
  isAdmin: false,
  async signOut() {},
};

export function AuthGate({ children }: { children: ReactNode }) {
  if (!isFirebaseConfigured) {
    return <AuthContext.Provider value={localAuth}>{children}</AuthContext.Provider>;
  }
  return <CloudAuth>{children}</CloudAuth>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Authentication is unavailable.');
  return value;
}

function CloudAuth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileAttempt, setProfileAttempt] = useState(0);
  const seenUid = useRef<string | null | undefined>(undefined);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), (next) => {
    setUser(next);
    const nextUid = next?.uid ?? null;
    if (seenUid.current !== nextUid) {
      seenUid.current = nextUid;
      setProfile(null);
      setProfileError('');
      setProfileReady(!next);
    }
    setAuthReady(true);
  }), []);

  useEffect(() => {
    if (!authReady) return undefined;
    const current = userRef.current;
    if (!current) return undefined;

    let active = true;
    let unsubscribe: (() => void) | null = null;
    const nameHint = stagedDisplayName();
    ensureUserProfile(current, nameHint)
      .then(() => {
        clearStagedDisplayName();
        if (!active) return;
        const stop = subscribeUserProfile(current.uid, (next) => {
          if (!active) return;
          setProfile(next);
          setProfileError(next ? '' : 'Your account profile is not available yet.');
          setProfileReady(true);
        }, (error) => {
          if (!active) return;
          setProfileError(error.message);
          setProfileReady(true);
        });
        if (!active) stop();
        else unsubscribe = stop;
      })
      .catch((error: unknown) => {
        clearStagedDisplayName();
        if (!active) return;
        setProfileError(error instanceof Error ? error.message : 'Could not open your account.');
        setProfileReady(true);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [authReady, profileAttempt, user?.uid]);

  const value = useMemo<AuthState>(() => ({
    configured: true,
    email: user?.email ?? null,
    uid: user?.uid ?? null,
    profile,
    isAdmin: profile?.status === 'APPROVED' && profile.role === 'ADMIN',
    signOut: () => signOut(getFirebaseAuth()),
  }), [user, profile]);

  if (!authReady || !profileReady) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <BrandMark />
      </div>
    );
  }

  let content: ReactNode;
  if (!user) {
    content = (
      <SignInScreen
        onSignIn={(staffEmail, password) => {
          clearStagedDisplayName();
          return signInWithEmailAndPassword(getFirebaseAuth(), staffEmail, password).then(() => undefined);
        }}
        onCreate={(staffEmail, password, name) => {
          stageDisplayName(name);
          return createUserWithEmailAndPassword(getFirebaseAuth(), staffEmail, password)
            .then(async (credential) => {
              const trimmed = name.trim();
              if (!trimmed) return;
              try {
                await updateProfile(credential.user, { displayName: trimmed });
              } catch (error) {
                console.warn('Could not save the display name.', error);
              }
            })
            .catch((error: unknown) => {
              clearStagedDisplayName();
              throw error;
            });
        }}
      />
    );
  } else if (profileError || !profile) {
    content = (
      <AccountStatusScreen
        tone="error"
        title="Account unavailable"
        message={profileError || 'Your account profile is not available yet.'}
        email={user.email}
        accountId={user.uid}
        onRetry={() => {
          setProfile(null);
          setProfileError('');
          setProfileReady(false);
          setProfileAttempt((attempt) => attempt + 1);
        }}
        onSignOut={() => void value.signOut()}
      />
    );
  } else if (profile.status === 'PENDING') {
    content = (
      <AccountStatusScreen
        tone="pending"
        title="Waiting for approval"
        message="Your account is awaiting admin approval. You will be able to access IITB LogiTrack once an administrator approves your request."
        detail="This page updates automatically when an administrator approves your account."
        email={profile.email}
        accountId={profile.uid}
        onSignOut={() => void value.signOut()}
      />
    );
  } else if (profile.status === 'REJECTED') {
    content = (
      <AccountStatusScreen
        tone="rejected"
        title="Access rejected"
        message="An administrator has rejected this account. You cannot access IITB LogiTrack."
        email={profile.email}
        accountId={profile.uid}
        onSignOut={() => void value.signOut()}
      />
    );
  } else if (profile.status === 'REVOKED') {
    content = (
      <AccountStatusScreen
        tone="rejected"
        title="Access revoked"
        message="An administrator has revoked this account. You cannot view records or create transactions. Your earlier records are kept."
        detail="Signing in again does not restore access. An administrator can restore it from Manage Users."
        email={profile.email}
        accountId={profile.uid}
        onSignOut={() => void value.signOut()}
      />
    );
  } else {
    content = children;
  }

  return <AuthContext.Provider value={value}>{content}</AuthContext.Provider>;
}
