import type { AppSettings, AssignableRole, FeatureMap, PermissionKey, PermissionMap, UserRole } from '../types/access';
import { FEATURE_KEYS, PERMISSION_KEYS } from '../types/access';

export const APP_NAME = 'IPT Logbook';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  scanItem: 'Scan items',
  recordTransaction: 'Record taking and returning',
  viewCurrentlyTaken: 'View currently taken items',
  viewAllHistory: 'View all transaction history',
  exportExcel: 'Export Excel files',
  manageInventory: 'Manage inventory records',
  manageUsers: 'Manage regular users',
  adminPanel: 'Open the admin panel',
  inviteUsers: 'Invite users',
  viewActivity: 'View activity logs',
};

export const FEATURE_LABELS: Record<keyof FeatureMap, string> = {
  scan: 'Barcode scanning',
  transactions: 'New transactions',
  history: 'Transaction history',
  taken: 'Currently taken list',
  excel: 'Excel export',
};

export function userPermissions(): PermissionMap {
  return {
    scanItem: true,
    recordTransaction: true,
    viewCurrentlyTaken: true,
    viewAllHistory: true,
    exportExcel: true,
    manageInventory: false,
    manageUsers: false,
    adminPanel: false,
    inviteUsers: false,
    viewActivity: false,
  };
}

export function adminPermissions(): PermissionMap {
  return {
    ...userPermissions(),
    manageInventory: true,
    manageUsers: true,
    adminPanel: true,
    inviteUsers: true,
    viewActivity: true,
  };
}

export function superAdminPermissions(): PermissionMap {
  return PERMISSION_KEYS.reduce((permissions, key) => {
    permissions[key] = true;
    return permissions;
  }, {} as PermissionMap);
}

export function permissionsForRole(role: UserRole): PermissionMap {
  if (role === 'SUPER_ADMIN') return superAdminPermissions();
  if (role === 'ADMIN') return adminPermissions();
  return userPermissions();
}

export function defaultFeatures(): FeatureMap {
  return {
    scan: true,
    transactions: true,
    history: true,
    taken: true,
    excel: true,
  };
}

export function defaultSettings(): AppSettings {
  return {
    applicationName: APP_NAME,
    institutionName: 'Indian Institute of Technology Bombay',
    logoUrl: '',
    registrationEnabled: false,
    approvalRequired: true,
    defaultRole: 'USER',
    transactionEditingEnabled: false,
    features: defaultFeatures(),
    updatedAt: null,
    updatedBy: null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAssignableRole(value: string): value is AssignableRole {
  return value === 'ADMIN' || value === 'USER';
}

export function permissionGranted(
  role: UserRole | null,
  permissions: PermissionMap | null,
  key: PermissionKey,
  active: boolean,
): boolean {
  if (!active || !role) return false;
  if (role === 'SUPER_ADMIN') return true;
  return permissions?.[key] === true;
}

export function samePermissions(left: PermissionMap, right: PermissionMap): boolean {
  return PERMISSION_KEYS.every((key) => left[key] === right[key]);
}

export function sanitizePermissions(value: Partial<PermissionMap> | null | undefined, fallback: PermissionMap): PermissionMap {
  const next = { ...fallback };
  for (const key of PERMISSION_KEYS) {
    if (typeof value?.[key] === 'boolean') next[key] = value[key];
  }
  return next;
}

export function sanitizeFeatures(value: Partial<FeatureMap> | null | undefined): FeatureMap {
  const next = defaultFeatures();
  for (const key of FEATURE_KEYS) {
    if (typeof value?.[key] === 'boolean') next[key] = value[key];
  }
  return next;
}
