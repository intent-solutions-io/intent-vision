/**
 * Role-Based Access Control (RBAC)
 *
 * Phase 15: Team Access, RBAC, and Audit Logging
 *
 * Defines roles and permissions for team collaboration:
 * - owner: Full control over organization
 * - admin: Manage members, sources, alerts, plans
 * - member: Manage metrics, alerts, view forecasts
 * - viewer: Read-only access to dashboards
 */

import { getDb } from '../firestore/client.js';
import { COLLECTIONS, type UserRole, type User } from '../firestore/schema.js';

// =============================================================================
// Permission Definitions
// =============================================================================

export type Permission =
  // Organization management
  | 'org:update'
  | 'org:delete'
  // Member management
  | 'members:invite'
  | 'members:remove'
  | 'members:update_role'
  // Source management
  | 'sources:create'
  | 'sources:update'
  | 'sources:delete'
  | 'sources:read'
  // Metric management
  | 'metrics:create'
  | 'metrics:update'
  | 'metrics:delete'
  | 'metrics:read'
  // Forecast access
  | 'forecasts:read'
  | 'forecasts:run'
  // Alert management
  | 'alerts:create'
  | 'alerts:update'
  | 'alerts:delete'
  | 'alerts:read'
  // API key management
  | 'api_keys:create'
  | 'api_keys:revoke'
  | 'api_keys:read'
  // Audit logs
  | 'audit:read'
  // Billing (owner only)
  | 'billing:read'
  | 'billing:update';

/**
 * Role-to-permissions mapping
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    // Owners have all permissions
    'org:update',
    'org:delete',
    'members:invite',
    'members:remove',
    'members:update_role',
    'sources:create',
    'sources:update',
    'sources:delete',
    'sources:read',
    'metrics:create',
    'metrics:update',
    'metrics:delete',
    'metrics:read',
    'forecasts:read',
    'forecasts:run',
    'alerts:create',
    'alerts:update',
    'alerts:delete',
    'alerts:read',
    'api_keys:create',
    'api_keys:revoke',
    'api_keys:read',
    'audit:read',
    'billing:read',
    'billing:update',
  ],
  admin: [
    // Admins can manage members, sources, alerts, plans
    'members:invite',
    'members:remove',
    'members:update_role',
    'sources:create',
    'sources:update',
    'sources:delete',
    'sources:read',
    'metrics:read',
    'forecasts:read',
    'forecasts:run',
    'alerts:create',
    'alerts:update',
    'alerts:delete',
    'alerts:read',
    'api_keys:create',
    'api_keys:revoke',
    'api_keys:read',
    'audit:read',
  ],
  member: [
    // Members can manage metrics, alerts, view forecasts
    'metrics:create',
    'metrics:update',
    'metrics:delete',
    'metrics:read',
    'sources:read',
    'forecasts:read',
    'forecasts:run',
    'alerts:create',
    'alerts:update',
    'alerts:delete',
    'alerts:read',
    'api_keys:read',
  ],
  viewer: [
    // Viewers have read-only access
    'metrics:read',
    'sources:read',
    'forecasts:read',
    'alerts:read',
  ],
};

// =============================================================================
// Permission Checks
// =============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

// =============================================================================
// User Role Lookup
// =============================================================================

/**
 * Get user's role within an organization
 * Returns null if user is not found or doesn't belong to the org
 */
export async function getUserRole(
  orgId: string,
  userId: string
): Promise<UserRole | null> {
  const db = getDb();

  // Get user document
  const userDoc = await db.collection(COLLECTIONS.users).doc(userId).get();

  if (!userDoc.exists) {
    return null;
  }

  const user = userDoc.data() as User;

  // Check if user belongs to this organization
  if (user.organizationId !== orgId) {
    return null;
  }

  return user.role;
}

/**
 * Get user by auth UID and check organization membership
 */
export async function getUserByAuthUid(authUid: string): Promise<User | null> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.users)
    .where('authUid', '==', authUid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as User;
}

// =============================================================================
// Authorization Guards
// =============================================================================

export class UnauthorizedError extends Error {
  constructor(
    message: string,
    public readonly requiredPermission?: Permission,
    public readonly userRole?: UserRole
  ) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Require that a user has a specific role within an organization
 * Throws UnauthorizedError if not authorized
 */
export async function requireRole(
  orgId: string,
  userId: string,
  allowedRoles: UserRole[]
): Promise<UserRole> {
  const role = await getUserRole(orgId, userId);

  if (!role) {
    throw new UnauthorizedError(
      'User not found or not a member of this organization'
    );
  }

  if (!allowedRoles.includes(role)) {
    throw new UnauthorizedError(
      `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`,
      undefined,
      role
    );
  }

  return role;
}

/**
 * Require that a user has a specific permission within an organization
 * Throws UnauthorizedError if not authorized
 */
export async function requirePermission(
  orgId: string,
  userId: string,
  permission: Permission
): Promise<UserRole> {
  const role = await getUserRole(orgId, userId);

  if (!role) {
    throw new UnauthorizedError(
      'User not found or not a member of this organization'
    );
  }

  if (!hasPermission(role, permission)) {
    throw new UnauthorizedError(
      `Insufficient permissions. Required permission: ${permission}`,
      permission,
      role
    );
  }

  return role;
}

/**
 * Require that a user has at least one of the specified permissions
 * Throws UnauthorizedError if not authorized
 */
export async function requireAnyPermission(
  orgId: string,
  userId: string,
  permissions: Permission[]
): Promise<UserRole> {
  const role = await getUserRole(orgId, userId);

  if (!role) {
    throw new UnauthorizedError(
      'User not found or not a member of this organization'
    );
  }

  if (!hasAnyPermission(role, permissions)) {
    throw new UnauthorizedError(
      `Insufficient permissions. Required one of: ${permissions.join(', ')}`,
      permissions[0],
      role
    );
  }

  return role;
}

/**
 * Check if user is authorized (returns boolean instead of throwing)
 */
export async function isAuthorized(
  orgId: string,
  userId: string,
  allowedRoles: UserRole[]
): Promise<boolean> {
  try {
    await requireRole(orgId, userId, allowedRoles);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if user has permission (returns boolean instead of throwing)
 */
export async function checkPermission(
  orgId: string,
  userId: string,
  permission: Permission
): Promise<boolean> {
  try {
    await requirePermission(orgId, userId, permission);
    return true;
  } catch {
    return false;
  }
}
