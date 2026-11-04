import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAccess } from './AccessProvider';
import { NAV_ITEMS } from './nav';
import { focusRing } from './styles';

export function AppNavLinks({ variant }: { variant: 'side' | 'bottom' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const access = useAccess();
  const items = NAV_ITEMS.filter((item) => {
    if (item.to === '/admin') return access.can('adminPanel');
    if (item.to === '/scan') return access.featureEnabled('scan') && access.can('scanItem');
    if (item.to === '/taken') return access.featureEnabled('taken') && access.can('viewCurrentlyTaken');
    if (item.to === '/history') return access.featureEnabled('history') && (access.can('viewAllHistory') || access.can('recordTransaction'));
    return true;
  });

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            state={item.to === '/scan' ? { reset: true } : undefined}
            onClick={(event) => {
              if (item.to === '/scan' && location.pathname === '/scan') {
                event.preventDefault();
                navigate('/scan', { replace: true, state: { reset: Date.now() } });
              }
            }}
            className={({ isActive }) => {
              if (variant === 'bottom') {
                const tone = isActive
                  ? item.to === '/scan' ? 'text-orange-600' : 'text-slate-900'
                  : 'text-slate-500';
                return `flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium ${tone} ${focusRing}`;
              }
              return `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${focusRing} ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`;
            }}
          >
            <Icon size={variant === 'bottom' ? 22 : 18} />
            {item.label}
          </NavLink>
        );
      })}
    </>
  );
}
