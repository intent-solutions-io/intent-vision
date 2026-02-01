/**
 * Invitations Routes
 *
 * Phase 15: Team Access, RBAC, and Audit Logging
 *
 * Endpoints:
 * - POST   /orgs/self/invitations           - Create invitation (admin+)
 * - POST   /invitations/:token/accept       - Accept invitation (public)
 * - GET    /orgs/self/invitations           - List pending invitations (admin+)
 * - DELETE /orgs/self/invitations/:id       - Cancel invitation (admin+)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { requireFirebaseAuth } from '../auth/firebase-auth.js';
import { requirePermission } from '../auth/rbac.js';
import { getUserByAuthUid } from '../services/org-service.js';
import {
  createInvitation,
  acceptInvitation,
  listPendingInvitations,
  cancelInvitation,
} from '../services/invitation-service.js';
import type { UserRole } from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: T;
  error?: string;
  durationMs?: number;
}

// =============================================================================
// Utilities
// =============================================================================

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson<T>(res: ServerResponse, statusCode: number, data: ApiResponse<T>): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// =============================================================================
// POST /orgs/self/invitations - Create Invitation
// =============================================================================

export async function handleCreateInvitation(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Require Firebase authentication
    const authContext = await requireFirebaseAuth(req);
    if (!authContext) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Authentication required',
      });
      return;
    }

    // Get user from auth UID
    const user = await getUserByAuthUid(authContext.uid);
    if (!user) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found',
      });
      return;
    }

    // Check permission - admin+ required to invite members
    await requirePermission(user.organizationId, user.id, 'members:invite');

    // Parse request
    const body = await parseBody<{
      email: string;
      role: UserRole;
    }>(req);

    const { email, role } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      throw new Error('email is required and must be a string');
    }

    if (!role || !['owner', 'admin', 'member', 'viewer'].includes(role)) {
      throw new Error('role must be one of: owner, admin, member, viewer');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Create invitation
    const invitation = await createInvitation({
      orgId: user.organizationId,
      email,
      role,
      invitedBy: user.id,
    });

    console.log(`[${requestId}] Created invitation ${invitation.id} for ${email}`);

    sendJson(res, 201, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          invitedAt: invitation.invitedAt,
          expiresAt: invitation.expiresAt,
          // Don't expose the token in the response
        },
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Create invitation error:`, errorMessage);

    const statusCode = errorMessage.includes('Insufficient permissions') ? 403 : 400;

    sendJson(res, statusCode, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// POST /invitations/:token/accept - Accept Invitation
// =============================================================================

export async function handleAcceptInvitation(
  req: IncomingMessage,
  res: ServerResponse,
  token: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Require Firebase authentication
    const authContext = await requireFirebaseAuth(req);
    if (!authContext) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Authentication required',
      });
      return;
    }

    // Parse request for optional display name
    const body = await parseBody<{
      displayName?: string;
    }>(req);

    // Accept the invitation
    const user = await acceptInvitation({
      token,
      userId: '', // Will be generated in the service
      authUid: authContext.uid,
      displayName: body.displayName,
    });

    console.log(`[${requestId}] User ${user.id} accepted invitation`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          organizationId: user.organizationId,
          role: user.role,
        },
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Accept invitation error:`, errorMessage);

    const statusCode = errorMessage.includes('not found') ? 404 : 400;

    sendJson(res, statusCode, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// GET /orgs/self/invitations - List Pending Invitations
// =============================================================================

export async function handleListInvitations(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Require Firebase authentication
    const authContext = await requireFirebaseAuth(req);
    if (!authContext) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Authentication required',
      });
      return;
    }

    // Get user from auth UID
    const user = await getUserByAuthUid(authContext.uid);
    if (!user) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found',
      });
      return;
    }

    // Check permission - admin+ required to view invitations
    await requirePermission(user.organizationId, user.id, 'members:invite');

    // List pending invitations
    const invitations = await listPendingInvitations(user.organizationId);

    console.log(`[${requestId}] Listed ${invitations.length} pending invitations`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        invitations: invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          invitedBy: inv.invitedBy,
          invitedAt: inv.invitedAt,
          expiresAt: inv.expiresAt,
        })),
        total: invitations.length,
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] List invitations error:`, errorMessage);

    const statusCode = errorMessage.includes('Insufficient permissions') ? 403 : 400;

    sendJson(res, statusCode, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// DELETE /orgs/self/invitations/:id - Cancel Invitation
// =============================================================================

export async function handleCancelInvitation(
  req: IncomingMessage,
  res: ServerResponse,
  invitationId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Require Firebase authentication
    const authContext = await requireFirebaseAuth(req);
    if (!authContext) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Authentication required',
      });
      return;
    }

    // Get user from auth UID
    const user = await getUserByAuthUid(authContext.uid);
    if (!user) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found',
      });
      return;
    }

    // Check permission - admin+ required to cancel invitations
    await requirePermission(user.organizationId, user.id, 'members:invite');

    // Cancel the invitation
    await cancelInvitation(user.organizationId, invitationId, user.id);

    console.log(`[${requestId}] Cancelled invitation ${invitationId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        cancelled: true,
        invitationId,
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Cancel invitation error:`, errorMessage);

    const statusCode = errorMessage.includes('Insufficient permissions')
      ? 403
      : errorMessage.includes('not found')
      ? 404
      : 400;

    sendJson(res, statusCode, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// Route Helpers
// =============================================================================

/**
 * Extract invitation token from pathname
 * Pattern: /invitations/:token/accept
 */
export function extractInvitationToken(pathname: string): string | null {
  const match = pathname.match(/^\/invitations\/([^/]+)\/accept$/);
  return match ? match[1] : null;
}

/**
 * Extract invitation ID from pathname
 * Pattern: /orgs/self/invitations/:id
 */
export function extractInvitationId(pathname: string): string | null {
  const match = pathname.match(/^\/orgs\/self\/invitations\/([^/]+)$/);
  return match ? match[1] : null;
}
