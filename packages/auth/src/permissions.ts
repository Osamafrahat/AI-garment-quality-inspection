export type Permission =
  | 'fleet:read' | 'fleet:write' | 'fleet:delete'
  | 'booking:read' | 'booking:write' | 'booking:delete' | 'booking:manage'
  | 'customer:read' | 'customer:write' | 'customer:delete'
  | 'billing:read' | 'billing:write' | 'billing:refund'
  | 'reports:read' | 'reports:export'
  | 'staff:read' | 'staff:write' | 'staff:delete'
  | 'settings:read' | 'settings:write'
  | 'maintenance:read' | 'maintenance:write'
  | 'inspection:read' | 'inspection:write';

export const rolePermissions: Record<string, Permission[]> = {
  CUSTOMER: [
    'booking:read', // own bookings only
    'customer:read', // own profile only
  ],
  STAFF: [
    'fleet:read',
    'booking:read',
    'booking:write', // check-in/out, manage own
    'customer:read',
    'maintenance:read',
    'maintenance:write',
    'inspection:read',
    'inspection:write',
  ],
  MANAGER: [
    'fleet:read',
    'fleet:write',
    'booking:read',
    'booking:write',
    'booking:manage',
    'customer:read',
    'customer:write',
    'billing:read',
    'billing:write',
    'reports:read',
    'staff:read',
    'maintenance:read',
    'maintenance:write',
    'inspection:read',
    'inspection:write',
    'settings:read',
  ],
  ADMIN: [
    'fleet:read', 'fleet:write', 'fleet:delete',
    'booking:read', 'booking:write', 'booking:delete', 'booking:manage',
    'customer:read', 'customer:write', 'customer:delete',
    'billing:read', 'billing:write', 'billing:refund',
    'reports:read', 'reports:export',
    'staff:read', 'staff:write', 'staff:delete',
    'settings:read', 'settings:write',
    'maintenance:read', 'maintenance:write',
    'inspection:read', 'inspection:write',
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export const permissionDescriptions: Record<Permission, string> = {
  'fleet:read': 'View vehicles, categories, locations',
  'fleet:write': 'Create/update vehicles and categories',
  'fleet:delete': 'Delete vehicles and categories',
  'booking:read': 'View bookings',
  'booking:write': 'Create/update bookings',
  'booking:delete': 'Cancel/delete bookings',
  'booking:manage': 'Override bookings, manual create, force status changes',
  'customer:read': 'View customer profiles',
  'customer:write': 'Update customer profiles, manage blacklist',
  'customer:delete': 'Delete customer accounts',
  'billing:read': 'View invoices and payments',
  'billing:write': 'Create invoices, process payments',
  'billing:refund': 'Process refunds',
  'reports:read': 'View dashboard and reports',
  'reports:export': 'Export reports as CSV/PDF',
  'staff:read': 'View staff list',
  'staff:write': 'Create/update staff accounts',
  'staff:delete': 'Deactivate staff accounts',
  'settings:read': 'View system settings',
  'settings:write': 'Modify system settings',
  'maintenance:read': 'View maintenance logs and schedule',
  'maintenance:write': 'Create/update maintenance logs',
  'inspection:read': 'View inspection reports',
  'inspection:write': 'Create/update inspections',
};