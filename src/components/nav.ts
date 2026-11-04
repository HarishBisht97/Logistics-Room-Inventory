import { LayoutDashboard, PackageOpen, ScanBarcode, ScrollText, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/scan', label: 'Scan', icon: ScanBarcode },
  { to: '/taken', label: 'Taken', icon: PackageOpen },
  { to: '/history', label: 'History', icon: ScrollText },
];

const MANAGE_USERS: NavItem = { to: '/users', label: 'Manage Users', icon: Users };

export function navigationItems(isAdmin: boolean): NavItem[] {
  return isAdmin ? [...NAV_ITEMS, MANAGE_USERS] : NAV_ITEMS;
}
