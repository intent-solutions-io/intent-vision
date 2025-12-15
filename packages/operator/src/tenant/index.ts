/**
 * Tenant Module
 *
 * Task ID: intentvision-10op.3
 *
 * Exports tenant context and multi-tenancy components:
 * - Context creation and management
 * - Organization isolation helpers
 */

export {
  createTenantContext,
  getContext,
  clearContext,
  withTenantContext,
  withTenantContextSync,
  addContextMetadata,
  getActiveContextCount,
  cleanupStaleContexts,
  verifyOrgAccess,
  applyOrgFilter,
  validateOrgOwnership,
  type TenantContext,
  type TenantContextOptions,
} from './context.js';
