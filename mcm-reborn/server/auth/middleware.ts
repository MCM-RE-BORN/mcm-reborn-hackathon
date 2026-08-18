import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { UnauthorizedError, ForbiddenError } from '@/contracts/errors';
import { UserRole } from '@/contracts/application';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
  displayName: string;
}

/**
 * Extract and verify JWT from Authorization header
 */
export async function authenticate(request: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  // Verify JWT with Supabase
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Get user profile with role
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new UnauthorizedError('User profile not found');
  }

  return {
    id: user.id,
    role: profile.role as UserRole,
    email: user.email ?? '',
    displayName: profile.display_name,
  };
}

/**
 * Require specific role
 */
export function requireRole(user: AuthenticatedUser, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(`Required role: ${allowedRoles.join(' or ')}`);
  }
}

/**
 * Check if user owns the resource
 */
export function requireOwnership(user: AuthenticatedUser, resourceOwnerId: string): void {
  if (user.id !== resourceOwnerId) {
    throw new ForbiddenError('You do not have permission to access this resource');
  }
}
