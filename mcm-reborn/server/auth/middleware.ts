import {
  createPublicSupabaseClient,
  createUserSupabaseClient,
} from '@/lib/supabase/server';
import {
  ForbiddenError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '@/contracts/errors';
import { UserRole } from '@/contracts/application';

export interface AuthenticatedUser {
  accessToken: string;
  id: string;
  role: UserRole;
  email: string;
  displayName: string;
}

/**
 * Extract and verify JWT from Authorization header
 */
export async function authenticate(request: Request): Promise<AuthenticatedUser> {
  const token = readBearerToken(request);
  const publicClient = createPublicSupabaseClient();
  const { data: { user }, error } = await publicClient.auth.getUser(token);

  if (error || !user) {
    if (typeof error?.status === 'number' && error.status >= 500) {
      throw new ServiceUnavailableError('Supabase Auth is unavailable');
    }
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Read the profile with the caller JWT so the profiles RLS policy remains
  // the authorization boundary. A service-role client is not needed here.
  const userClient = createUserSupabaseClient(token);
  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new ServiceUnavailableError('Supabase profile storage is unavailable');
  }
  if (!profile) {
    throw new UnauthorizedError('User profile not found');
  }
  if (profile.role !== 'CUSTOMER' && profile.role !== 'OPERATOR') {
    throw new UnauthorizedError('User profile role is invalid');
  }
  if (
    typeof profile.display_name !== 'string' ||
    profile.display_name.trim().length === 0 ||
    typeof user.email !== 'string' ||
    user.email.length === 0
  ) {
    throw new UnauthorizedError('User profile is incomplete');
  }

  return {
    accessToken: token,
    id: user.id,
    role: profile.role,
    email: user.email,
    displayName: profile.display_name,
  };
}

export function readBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization')?.trim();
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  return match[1];
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
