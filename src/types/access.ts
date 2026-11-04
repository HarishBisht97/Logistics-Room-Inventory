export const PERMISSION_KEYS = [
  'scanItem',
  'recordTransaction',
  'viewCurrentlyTaken',
  'viewAllHistory',
  'exportExcel',
  'manageInventory',
  'manageUsers',
  'adminPanel',
  'inviteUsers',
  'viewActivity',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionMap = Record<PermissionKey, boolean>;

export const FEATURE_KEYS = ['scan', 'transactions', 'history', 'taken', 'excel'] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureMap = Record<FeatureKey, boolean>;

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export type AssignableRole = 'ADMIN' | 'USER';

export type AccountStatus = 'INVITED' | 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'REMOVED';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  permissions: PermissionMap;
  createdAt: string | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  protected: boolean;
}

export interface Invitation {
  email: string;
  name: string;
  role: AssignableRole;
  status: 'INVITED' | 'REVOKED';
  invitedBy: string;
  invitedAt: string | null;
}

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  description: string;
  targetId: string | null;
  timestamp: string | null;
  metadata: Record<string, string>;
}

export interface AppSettings {
  applicationName: string;
  institutionName: string;
  logoUrl: string;
  registrationEnabled: boolean;
  approvalRequired: boolean;
  defaultRole: 'USER';
  transactionEditingEnabled: boolean;
  features: FeatureMap;
  updatedAt: string | null;
  updatedBy: string | null;
}
