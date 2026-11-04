import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { LoaderCircle } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { darkButton, secondaryButton, textInput } from './styles';

interface SignInScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onCreate: (email: string, password: string) => Promise<void>;
}

export function SignInScreen({ onSignIn, onCreate }: SignInScreenProps) {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (creating) await onCreate(email.trim(), password);
      else await onSignIn(email.trim(), password);
    } catch (caught) {
      setError(authMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8">
      <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col justify-center">
        <BrandMark />
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-4" noValidate>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{creating ? 'Create staff account' : 'Sign in'}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Logistics records are shared with signed-in staff through Firestore.
            </p>
          </div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="staff-email">
            Email
            <input
              id="staff-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className={`${textInput} mt-1.5`}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700" htmlFor="staff-password">
            Password
            <input
              id="staff-password"
              type="password"
              autoComplete={creating ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className={`${textInput} mt-1.5`}
            />
          </label>
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
          <button type="submit" className={`${darkButton} w-full`} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" size={18} /> : null}
            {creating ? 'Create account' : 'Sign in'}
          </button>
          <button
            type="button"
            className={`${secondaryButton} w-full`}
            onClick={() => {
              setCreating((current) => !current);
              setError('');
            }}
          >
            {creating ? 'Use an existing account' : 'Create staff account'}
          </button>
          <p className="text-xs leading-5 text-slate-500">
            Create accounts only for logistics staff. After the first accounts exist, public sign-up can be turned off in the Firebase console.
          </p>
        </form>
      </div>
    </div>
  );
}

function authMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials') {
      return 'That email or password is not correct.';
    }
    if (error.code === 'auth/email-already-in-use') return 'An account with that email already exists. Sign in instead.';
    if (error.code === 'auth/weak-password') return 'Use a password of at least 6 characters.';
    if (error.code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (error.code === 'auth/network-request-failed') return 'You appear to be offline.';
    if (error.code === 'auth/operation-not-allowed' || error.message.includes('CONFIGURATION_NOT_FOUND')) {
      return 'Email and password sign-in is not set up yet. In the Firebase console, open Authentication, click Get started, then enable Email/Password.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Could not sign in.';
}
