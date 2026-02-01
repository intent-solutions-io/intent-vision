/**
 * Role-Based Access Control (RBAC)
 *
 * Task ID: intentvision-cvo (Phase C)
 *
 * Provides role-based access control:
 * - Role hierarchy: admin > operator > viewer
 * - Permission system: read, write, delete, admin
 * - Permission checking for roles
 */

// =============================================================================
// Types
// =============================================================================

export type Role = 'admin' | 'operator' | 'viewer';
export type Permission = 'read' | 'write' | 'delete' | 'admin';

// =============================================================================
// Role Hierarchy
// =============================================================================

/**
 * Role hierarchy levels (higher number = more permissions)
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
};

/**
 * Permissions granted by each role
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ['read'],
  operator: ['read', 'write'],
  admin: ['read', 'write', 'delete', 'admin'],
};

// =============================================================================
// Permission Checking
// =============================================================================

/**
 * Check if a role has a specific permission
 *
 * @param role - The role to check
 * @param permission - The permission to verify
 * @returns True if the role has the permission
 *
 * @example
 * hasPermission('operator', 'write'); // true
 * hasPermission('viewer', 'write');   // false
 * hasPermission('admin', 'delete');   // true
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

/**
 * Check if any of the provided roles has a specific permission
 *
 * @param roles - Array of roles to check
 * @param permission - The permission to verify
 * @returns True if any role has the permission
 *
 * @example
 * checkPermission(['viewer', 'operator'], 'write'); // true (operator can write)
 * checkPermission(['viewer'], 'write');             // false
 * checkPermission(['admin'], 'delete');             // true
 */
export function checkPermission(roles: string[], permission: Permission): boolean {
  // If no roles provided, deny access
  if (!roles || roles.length === 0) {
    return false;
  }

  // Check if any role has the required permission
  for (const role of roles) {
    // Validate role is one of the known roles
    if (!isValidRole(role)) {
      continue;
    }

    if (hasPermission(role as Role, permission)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user has all required permissions
 *
 * @param roles - Array of user roles
 * @param permissions - Array of required permissions
 * @returns True if user has all required permissions
 */
export function hasAllPermissions(roles: string[], permissions: Permission[]): boolean {
  for (const permission of permissions) {
    if (!checkPermission(roles, permission)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if user has any of the required permissions
 *
 * @param roles - Array of user roles
 * @param permissions - Array of permissions (user needs at least one)
 * @returns True if user has at least one of the permissions
 */
export function hasAnyPermission(roles: string[], permissions: Permission[]): boolean {
  for (const permission of permissions) {
    if (checkPermission(roles, permission)) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// Role Validation
// =============================================================================

/**
 * Check if a string is a valid role
 */
export function isValidRole(role: string): role is Role {
  return role === 'admin' || role === 'operator' || role === 'viewer';
}

/**
 * Validate and filter an array of roles
 *
 * @param roles - Array of role strings
 * @returns Array of valid roles only
 */
export function validateRoles(roles: string[]): Role[] {
  return roles.filter(isValidRole);
}

/**
 * Get the highest role from an array of roles
 *
 * @param roles - Array of roles
 * @returns The highest role, or null if none valid
 *
 * @example
 * getHighestRole(['viewer', 'admin']); // 'admin'
 * getHighestRole(['operator', 'viewer']); // 'operator'
 */
export function getHighestRole(roles: string[]): Role | null {
  const validRoles = validateRoles(roles);

  if (validRoles.length === 0) {
    return null;
  }

  return validRoles.reduce((highest, current) => {
    return ROLE_HIERARCHY[current] > ROLE_HIERARCHY[highest] ? current : highest;
  });
}

// =============================================================================
// Role Comparison
// =============================================================================

/**
 * Check if role A is higher than or equal to role B in hierarchy
 *
 * @param roleA - First role
 * @param roleB - Second role
 * @returns True if roleA >= roleB in hierarchy
 */
export function isRoleHigherOrEqual(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Check if any of the user's roles is higher than or equal to required role
 *
 * @param userRoles - User's roles
 * @param requiredRole - Required role level
 * @returns True if user has sufficient role level
 */
export function hasRoleLevel(userRoles: string[], requiredRole: Role): boolean {
  const validRoles = validateRoles(userRoles);
  const highestRole = getHighestRole(validRoles);

  if (!highestRole) {
    return false;
  }

  return isRoleHigherOrEqual(highestRole, requiredRole);
}

// =============================================================================
// Permission Lists
// =============================================================================

/**
 * Get all permissions for a role
 *
 * @param role - The role to check
 * @returns Array of permissions for the role
 */
export function getRolePermissions(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/**
 * Get all permissions for any of the provided roles (union)
 *
 * @param roles - Array of roles
 * @returns Array of all unique permissions
 */
export function getAllPermissions(roles: string[]): Permission[] {
  const validRoles = validateRoles(roles);
  const permissionSet = new Set<Permission>();

  for (const role of validRoles) {
    const permissions = ROLE_PERMISSIONS[role];
    permissions.forEach((p) => permissionSet.add(p));
  }

  return Array.from(permissionSet);
}

// =============================================================================
// Exports
// =============================================================================

export const ROLES = {
  ADMIN: 'admin' as Role,
  OPERATOR: 'operator' as Role,
  VIEWER: 'viewer' as Role,
};

export const PERMISSIONS = {
  READ: 'read' as Permission,
  WRITE: 'write' as Permission,
  DELETE: 'delete' as Permission,
  ADMIN: 'admin' as Permission,
};
