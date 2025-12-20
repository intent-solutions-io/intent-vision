/**
 * Audit Service
 *
 * Phase 15: Team Access, RBAC, and Audit Logging
 *
 * Manages audit logging for organization actions and events.
 */

import { getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type AuditLog,
  type AuditAction,
} from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

export interface LogAuditEventParams {
  orgId: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface GetAuditLogsOptions {
  limit?: number;
  before?: Date;
  action?: AuditAction;
  userId?: string;
  resourceType?: string;
}

// =============================================================================
// Audit Operations
// =============================================================================

/**
 * Log an audit event
 */
export async function logAuditEvent(params: LogAuditEventParams): Promise<AuditLog> {
  const db = getDb();
  const {
    orgId,
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    ipAddress,
    userAgent,
  } = params;

  const auditLogId = generateId('audit');
  const now = new Date();

  const auditLog: AuditLog = {
    id: auditLogId,
    orgId,
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    ipAddress,
    userAgent,
    createdAt: now,
  };

  await db
    .collection(COLLECTIONS.auditLogs(orgId))
    .doc(auditLogId)
    .set(auditLog);

  console.log(
    `[AuditService] Logged ${action} by user ${userId} on ${resourceType}:${resourceId}`
  );

  return auditLog;
}

/**
 * Get audit logs for an organization with optional filters
 */
export async function getAuditLogs(
  orgId: string,
  options: GetAuditLogsOptions = {}
): Promise<AuditLog[]> {
  const db = getDb();
  const { limit = 50, before, action, userId, resourceType } = options;

  // Build query
  let query = db
    .collection(COLLECTIONS.auditLogs(orgId))
    .orderBy('createdAt', 'desc')
    .limit(limit);

  // Apply filters
  if (before) {
    query = query.where('createdAt', '<', before);
  }

  if (action) {
    query = query.where('action', '==', action);
  }

  if (userId) {
    query = query.where('userId', '==', userId);
  }

  if (resourceType) {
    query = query.where('resourceType', '==', resourceType);
  }

  const snapshot = await query.get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => doc.data() as AuditLog);
}

/**
 * Get recent audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  orgId: string,
  resourceType: string,
  resourceId: string,
  limit = 20
): Promise<AuditLog[]> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.auditLogs(orgId))
    .where('resourceType', '==', resourceType)
    .where('resourceId', '==', resourceId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => doc.data() as AuditLog);
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  orgId: string,
  userId: string,
  limit = 50
): Promise<AuditLog[]> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.auditLogs(orgId))
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => doc.data() as AuditLog);
}

/**
 * Delete old audit logs (for retention policy)
 * Typically called by a background job
 */
export async function deleteOldAuditLogs(
  orgId: string,
  olderThan: Date
): Promise<number> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.auditLogs(orgId))
    .where('createdAt', '<', olderThan)
    .get();

  const batch = db.batch();
  let count = 0;

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    count++;
  });

  if (count > 0) {
    await batch.commit();
    console.log(`[AuditService] Deleted ${count} old audit logs for org ${orgId}`);
  }

  return count;
}
