import { LayoutDashboard, PackageOpen, ScanBarcode, ScrollText, type LucideIcon } from 'lucide-react';

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
