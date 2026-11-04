import { NavLink, Outlet } from 'react-router-dom';
import { useAccess } from '../../components/AccessProvider';
import { PageHeader } from '../../components/PageHeader';
import { focusRing } from '../../components/styles';

const LINKS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Users', end: false },
  { to: '/admin/approvals', label: 'Approvals', end: false },
  { to: '/admin/activity', label: 'Activity', end: false },
  { to: '/admin/access', label: 'Access', end: false },
  { to: '/admin/settings', label: 'Settings', end: false, superOnly: true },
];

export default function AdminLayout() {
  const access = useAccess();
  if (access.configured && !access.can('adminPanel')) {
    return <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">Your account cannot open the admin panel.</p>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin"
        description="Manage who can use the logbook. Access changes apply on every signed-in device."
      />
      <nav aria-label="Admin" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {LINKS.filter((link) => !link.superOnly || access.isSuperAdmin).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${focusRing} ${
              isActive ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
