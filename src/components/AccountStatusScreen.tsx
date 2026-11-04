import { useEffect } from 'react';
import { BrandMark } from './BrandMark';
import { darkButton, secondaryButton } from './styles';

interface AccountStatusScreenProps {
  title: string;
  message: string;
  detail?: string;
  tone: 'pending' | 'rejected' | 'error';
  email?: string | null;
  accountId?: string | null;
  onRetry?: () => void;
  onSignOut: () => void;
}

export function AccountStatusScreen({ title, message, detail, tone, email, accountId, onRetry, onSignOut }: AccountStatusScreenProps) {
  useEffect(() => {
    document.title = `${title} · IPT Logbook`;
  }, [title]);

  const badge = tone === 'pending'
    ? 'bg-orange-100 text-orange-800'
    : tone === 'rejected'
      ? 'bg-red-100 text-red-800'
      : 'bg-slate-200 text-slate-700';
  const label = tone === 'pending' ? 'Pending' : tone === 'rejected' ? 'Rejected' : 'Unavailable';

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8">
      <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col justify-center">
        <BrandMark />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>{label}</span>
          <h1 className="mt-3 text-lg font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          {detail ? <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p> : null}
          {email ? <p className="mt-3 truncate text-sm text-slate-500">{email}</p> : null}
          {accountId ? <p className="mt-2 break-all text-xs leading-5 text-slate-500">Account ID: {accountId}</p> : null}
          {onRetry ? (
            <button type="button" onClick={onRetry} className={`${darkButton} mt-5 w-full`}>
              Try again
            </button>
          ) : null}
          <button type="button" onClick={onSignOut} className={`${secondaryButton} ${onRetry ? 'mt-2' : 'mt-5'} w-full`}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
