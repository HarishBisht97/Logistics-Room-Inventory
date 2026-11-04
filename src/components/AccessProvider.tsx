import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, PermissionKey, UserProfile } from '../types/access';
import type { FeatureKey } from '../types/access';
import { defaultSettings, permissionGranted } from '../services/accessModel';
import { ensureOwnProfile, touchActivity, watchOwnProfile, watchSettings, writeAudit } from '../services/accountService';
import { useAuth } from './AuthGate';
import { BrandMark } from './BrandMark';
import { darkButton } from './styles';

interface AccessValue {
  configured: boolean;
  uid: string | null;
  email: string | null;
  profile: UserProfile | null;
  settings: AppSettings;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  can: (key: PermissionKey) => boolean;
  featureEnabled: (key: FeatureKey) => boolean;
  signOut: () => Promise<void>;
}

const AccessContext = createContext<AccessValue | null>(null);

const localAccess: AccessValue = {
  configured: false,
  uid: null,
  email: null,
  profile: null,
  settings: defaultSettings(),
  loading: false,
  isSuperAdmin: false,
  isAdmin: false,
  can: (key) => key === 'scanItem' || key === 'recordTransaction' || key === 'viewCurrentlyTaken' || key === 'viewAllHistory' || key === 'exportExcel',
  featureEnabled: () => true,
  async signOut() {},
};

export function AccessProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.configured) {
    return <AccessContext.Provider value={localAccess}>{children}</AccessContext.Provider>;
  }
  return (
    <CloudAccess uid={auth.uid} email={auth.email} onSignOut={auth.signOut}>
      {children}
    </CloudAccess>
  );
}

export function useAccess(): AccessValue {
  const value = useContext(AccessContext);
  if (!value) throw new Error('Account access is unavailable.');
  return value;
}

export function useOptionalAccess(): AccessValue | null {
  return useContext(AccessContext);
}

function CloudAccess({
  uid,
  email,
  onSignOut,
  children,
}: {
  uid: string | null;
  email: string | null;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const signedIn = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || !email) return undefined;
    let active = true;
    setReady(false);
    setError('');
    ensureOwnProfile({ uid, email }).catch((caught) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : 'Could not open your account.');
      setReady(true);
    });
    const stopProfile = watchOwnProfile(uid, (next) => {
      if (!active) return;
      setProfile(next);
      if (next) {
        setError('');
        setReady(true);
      }
    }, (message) => {
      if (active) setError(message);
    });
    const stopSettings = watchSettings(setSettings, () => undefined);
    return () => {
      active = false;
      stopProfile();
      stopSettings();
    };
  }, [uid, email]);

  useEffect(() => {
    if (!profile || signedIn.current === profile.uid) return;
    signedIn.current = profile.uid;
    touchActivity(profile.uid).catch(() => undefined);
    writeAudit(profile, 'LOGIN', 'Signed in.', null).catch(() => undefined);
  }, [profile]);

  const value = useMemo<AccessValue>(() => {
    const active = profile?.status === 'ACTIVE';
    const isSuperAdmin = active && profile?.role === 'SUPER_ADMIN';
    return {
      configured: true,
      uid,
      email,
      profile,
      settings,
      loading: !ready,
      isSuperAdmin,
      isAdmin: active && profile?.role === 'ADMIN',
      can: (key) => permissionGranted(profile?.role ?? null, profile?.permissions ?? null, key, active === true),
      featureEnabled: (key) => isSuperAdmin || settings.features[key] !== false,
      signOut: async () => {
        if (profile) {
          try {
            await writeAudit(profile, 'LOGOUT', 'Signed out.', null);
          } catch {
            // Signing out still proceeds when the log cannot be written.
          }
        }
        signedIn.current = null;
        await onSignOut();
      },
    };
  }, [uid, email, profile, settings, ready, onSignOut]);

  if (!ready && !error) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <BrandMark />
      </div>
    );
  }

  if (!profile || profile.status !== 'ACTIVE') {
    return (
      <AccessContext.Provider value={value}>
        <AccountHold
          profile={profile}
          settings={settings}
          error={error}
          onSignOut={() => {
            void value.signOut();
          }}
          onRetry={() => {
            if (!uid || !email) return;
            setError('');
            setReady(false);
            ensureOwnProfile({ uid, email }).catch((caught) => {
              setError(caught instanceof Error ? caught.message : 'Could not open your account.');
              setReady(true);
            });
          }}
        />
      </AccessContext.Provider>
    );
  }

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

function AccountHold({
  profile,
  settings,
  error,
  onSignOut,
  onRetry,
}: {
  profile: UserProfile | null;
  settings: AppSettings;
  error: string;
  onSignOut: () => void;
  onRetry: () => void;
}) {
  const title = holdTitle(profile, error);
  const description = holdDescription(profile, error);
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <BrandMark name={settings.applicationName} institution={settings.institutionName} logoUrl={settings.logoUrl} />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-5 flex flex-col gap-2">
            {!profile ? (
              <button type="button" onClick={onRetry} className={`${darkButton} w-full`}>Check again</button>
            ) : null}
            <button type="button" onClick={onSignOut} className="min-h-12 text-sm font-semibold text-slate-700">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function holdTitle(profile: UserProfile | null, error: string): string {
  if (!profile && error) return 'No application access';
  if (!profile) return 'Checking your account';
  if (profile.status === 'PENDING_APPROVAL') return 'Waiting for approval';
  if (profile.status === 'SUSPENDED') return 'Account suspended';
  if (profile.status === 'REJECTED') return 'Request rejected';
  if (profile.status === 'REMOVED') return 'Access removed';
  return 'No application access';
}

function holdDescription(profile: UserProfile | null, error: string): string {
  if (!profile && error) return error;
  if (profile?.status === 'PENDING_APPROVAL') {
    return 'A super admin still needs to approve this account. You can sign in, but logistics records stay closed until then.';
  }
  if (profile?.status === 'SUSPENDED') {
    return 'This account is suspended. You cannot view records or create transactions. Your earlier transactions are kept.';
  }
  if (profile?.status === 'REJECTED') {
    return 'A super admin rejected this registration. Signing in again does not restore access.';
  }
  if (profile?.status === 'REMOVED') {
    return 'Your access to the logistics records has been removed. This does not delete the Firebase sign-in account, and your earlier transactions stay in the history.';
  }
  return 'Ask a super admin to invite this email before using the logbook.';
}
