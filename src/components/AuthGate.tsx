import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase/firebase';
import { BrandMark } from './BrandMark';
import { SignInScreen } from './SignInScreen';

interface AuthState {
  configured: boolean;
  uid: string | null;
  email: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const localAuth: AuthState = {
  configured: false,
  uid: null,
  email: null,
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
  const [email, setEmail] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), (user) => {
    setEmail(user?.email ?? null);
    setUid(user?.uid ?? null);
    setReady(true);
  }), []);

  const value = useMemo<AuthState>(() => ({
    configured: true,
    uid,
    email,
    signOut: () => signOut(getFirebaseAuth()),
  }), [email, uid]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <BrandMark />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {email ? children : (
        <SignInScreen
          onSignIn={(staffEmail, password) => signInWithEmailAndPassword(getFirebaseAuth(), staffEmail, password).then(() => undefined)}
          onCreate={(staffEmail, password) => createUserWithEmailAndPassword(getFirebaseAuth(), staffEmail, password).then(() => undefined)}
        />
      )}
    </AuthContext.Provider>
  );
}
