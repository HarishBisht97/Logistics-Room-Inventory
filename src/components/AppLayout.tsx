import { Outlet } from 'react-router-dom';
import { useAccess } from './AccessProvider';
import { useAuth } from './AuthGate';
import { AppNavLinks } from './AppNavLinks';
import { BottomNavigation } from './BottomNavigation';
import { BrandMark } from './BrandMark';
import { MigrationPrompt } from './MigrationPrompt';
import { SyncStatus } from './SyncStatus';
import { focusRing } from './styles';

export function AppLayout() {
  const auth = useAuth();
  const access = useAccess();
  const brand = {
    name: access.settings.applicationName,
    institution: access.settings.institutionName,
    logoUrl: access.settings.logoUrl,
  };

  return (
    <div className="min-h-dvh border-t-2 border-[#004f9f] bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-5 py-5">
          <BrandMark {...brand} />
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3">
          <AppNavLinks variant="side" />
        </nav>
        <div className="space-y-3 px-5 py-4">
          <SyncStatus />
          {auth.email ? <p className="truncate text-xs text-slate-500">{auth.email}</p> : null}
          {auth.configured ? (
            <button type="button" onClick={() => void access.signOut()} className={`text-sm font-semibold text-slate-700 ${focusRing}`}>
              Sign out
            </button>
          ) : null}
          <p className="text-xs leading-5 text-slate-400">
            {auth.configured
              ? 'Records sync through Firestore for every signed-in device.'
              : 'Saved on this device until Firebase is configured.'}
          </p>
        </div>
      </aside>

      <div className="md:pl-72">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <BrandMark compact {...brand} />
          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            <SyncStatus />
            {auth.configured ? (
              <button type="button" onClick={() => void access.signOut()} className={`text-xs font-semibold text-slate-700 ${focusRing}`}>
                Sign out
              </button>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-10">
          {!auth.configured ? (
            <p className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm leading-6 text-slate-600">
              Firebase is not configured, so records stay on this device.
            </p>
          ) : null}
          <MigrationPrompt />
          <Outlet />
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
