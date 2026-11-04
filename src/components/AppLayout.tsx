import { Package } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { AppNavLinks } from './AppNavLinks';
import { BottomNavigation } from './BottomNavigation';

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
            <Package size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Logistics Room</p>
            <p className="text-xs text-slate-500">Inventory</p>
          </div>
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3">
          <AppNavLinks variant="side" />
        </nav>
        <p className="px-5 py-4 text-xs leading-5 text-slate-400">Saved in this browser. Nothing is sent to a server.</p>
      </aside>

      <div className="md:pl-64">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white">
            <Package size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Logistics Room</p>
            <p className="text-xs text-slate-500">Inventory</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
