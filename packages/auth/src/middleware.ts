import { auth } from './config';
import { hasPermission, type Permission } from './permissions';
import { NextResponse } from 'next/server';
import { AppError } from '@car-rental/core/errors';

export const authMiddleware = auth((req) => {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/api/admin') || pathname.startsWith('/admin')) {
    const session = req.auth;
    if (!session?.user) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }

    const requiredPermissions = getRequiredPermissions(pathname);
    if (!hasAllPermissions(session.user.role, requiredPermissions)) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  return NextResponse.next();
});

function getRequiredPermissions(pathname: string): Permission[] {
  if (pathname.startsWith('/api/admin/fleet') || pathname.startsWith('/admin/fleet')) {
    return pathname.includes('delete') ? ['fleet:delete'] : ['fleet:read', 'fleet:write'];
  }
  if (pathname.startsWith('/api/admin/booking') || pathname.startsWith('/admin/booking')) {
    return ['booking:read', 'booking:write'];
  }
  if (pathname.startsWith('/api/admin/billing') || pathname.startsWith('/admin/billing')) {
    return ['billing:read', 'billing:write'];
  }
  if (pathname.startsWith('/api/admin/reports') || pathname.startsWith('/admin/reports')) {
    return ['reports:read'];
  }
  if (pathname.startsWith('/api/admin/staff') || pathname.startsWith('/admin/staff')) {
    return ['staff:read', 'staff:write'];
  }
  if (pathname.startsWith('/api/admin/settings') || pathname.startsWith('/admin/settings')) {
    return ['settings:read', 'settings:write'];
  }
  return [];
}

function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function requireAuth() {
  return async () => {
    const session = await auth();
    if (!session?.user) {
      throw AppError.unauthorized('Authentication required');
    }
    return session;
  };
}

export function requirePermission(permission: Permission) {
  return async () => {
    const session = await auth();
    if (!session?.user) {
      throw AppError.unauthorized('Authentication required');
    }
    if (!hasPermission(session.user.role, permission)) {
      throw AppError.forbidden(`Permission required: ${permission}`);
    }
    return session;
  };
}

export function requireRole(...roles: string[]) {
  return async () => {
    const session = await auth();
    if (!session?.user) {
      throw AppError.unauthorized('Authentication required');
    }
    if (!roles.includes(session.user.role)) {
      throw AppError.forbidden(`Role required: ${roles.join(' or ')}`);
    }
    return session;
  };
}