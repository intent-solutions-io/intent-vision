/**
 * Invitation Service
 *
 * Phase 15: Team Access, RBAC, and Audit Logging
 *
 * Manages organization invitations for team collaboration.
 */

import { getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type OrgInvitation,
  type UserRole,
  type User,
} from '../firestore/schema.js';
import { createUser } from './org-service.js';
import { logAuditEvent } from './audit-service.js';

// =============================================================================
// Types
// =============================================================================

export interface CreateInvitationParams {
  orgId: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  expirationDays?: number;
}

export interface AcceptInvitationParams {
  token: string;
  userId: string;
  authUid: string;
  displayName?: string;
}

// =============================================================================
// Invitation Operations
// =============================================================================

/**
 * Generate a secure random token for invitation
 */
function generateInvitationToken(): string {
  // Generate a secure random token (32 characters)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create a new organization invitation
 */
export async function createInvitation(
  params: CreateInvitationParams
): Promise<OrgInvitation> {
  const db = getDb();
  const { orgId, email, role, invitedBy, expirationDays = 7 } = params;

  // Check if there's already a pending invitation for this email
  const existingSnapshot = await db
    .collection(COLLECTIONS.invitations(orgId))
    .where('email', '==', email)
    .where('status', '==', 'pending')
    .get();

  if (!existingSnapshot.empty) {
    throw new Error('A pending invitation already exists for this email');
  }

  // Check if user with this email already exists in the org
  const userSnapshot = await db
    .collection(COLLECTIONS.users)
    .where('email', '==', email)
    .where('organizationId', '==', orgId)
    .limit(1)
    .get();

  if (!userSnapshot.empty) {
    throw new Error('User with this email is already a member of the organization');
  }

  const invitationId = generateId('inv');
  const token = generateInvitationToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);

  const invitation: OrgInvitation = {
    id: invitationId,
    orgId,
    email,
    role,
    token,
    status: 'pending',
    invitedBy,
    invitedAt: now,
    expiresAt,
  };

  await db
    .collection(COLLECTIONS.invitations(orgId))
    .doc(invitationId)
    .set(invitation);

  // Log audit event
  await logAuditEvent({
    orgId,
    userId: invitedBy,
    action: 'member.invited',
    resourceType: 'invitation',
    resourceId: invitationId,
    metadata: { email, role },
  });

  console.log(`[InvitationService] Created invitation ${invitationId} for ${email}`);

  return invitation;
}

/**
 * Get invitation by token (internal helper)
 */
async function getInvitation(token: string): Promise<OrgInvitation | null> {
  const db = getDb();

  // Search across all organizations for the invitation token
  // Note: In production, you might want to index this differently
  // For now, we'll need to query the organizations first
  const orgsSnapshot = await db.collection(COLLECTIONS.organizations).get();

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id;
    const invitationSnapshot = await db
      .collection(COLLECTIONS.invitations(orgId))
      .where('token', '==', token)
      .limit(1)
      .get();

    if (!invitationSnapshot.empty) {
      return invitationSnapshot.docs[0].data() as OrgInvitation;
    }
  }

  return null;
}

/**
 * Accept an invitation and create user account
 */
export async function acceptInvitation(
  params: AcceptInvitationParams
): Promise<User> {
  const db = getDb();
  const { token, authUid, displayName } = params;

  // Get the invitation
  const invitation = await getInvitation(token);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Invitation is ${invitation.status}`);
  }

  // Check if invitation has expired
  if (new Date() > invitation.expiresAt) {
    // Mark as expired
    await db
      .collection(COLLECTIONS.invitations(invitation.orgId))
      .doc(invitation.id)
      .update({ status: 'expired' });

    throw new Error('Invitation has expired');
  }

  // Check if user already exists
  const existingUserSnapshot = await db
    .collection(COLLECTIONS.users)
    .where('authUid', '==', authUid)
    .limit(1)
    .get();

  if (!existingUserSnapshot.empty) {
    const existingUser = existingUserSnapshot.docs[0].data() as User;
    if (existingUser.organizationId === invitation.orgId) {
      throw new Error('User is already a member of this organization');
    }
    throw new Error('User already belongs to another organization');
  }

  // Create the user
  const user = await createUser({
    authUid,
    email: invitation.email,
    displayName,
    organizationId: invitation.orgId,
    role: invitation.role,
  });

  // Mark invitation as accepted
  await db
    .collection(COLLECTIONS.invitations(invitation.orgId))
    .doc(invitation.id)
    .update({
      status: 'accepted',
      acceptedAt: new Date(),
    });

  // Log audit event
  await logAuditEvent({
    orgId: invitation.orgId,
    userId: user.id,
    action: 'member.joined',
    resourceType: 'user',
    resourceId: user.id,
    metadata: { email: user.email, role: user.role, invitationId: invitation.id },
  });

  console.log(`[InvitationService] User ${user.id} accepted invitation ${invitation.id}`);

  return user;
}

/**
 * List pending invitations for an organization
 */
export async function listPendingInvitations(
  orgId: string
): Promise<OrgInvitation[]> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.invitations(orgId))
    .where('status', '==', 'pending')
    .orderBy('invitedAt', 'desc')
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => doc.data() as OrgInvitation);
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(
  orgId: string,
  invitationId: string,
  cancelledBy: string
): Promise<void> {
  const db = getDb();

  const invitationRef = db
    .collection(COLLECTIONS.invitations(orgId))
    .doc(invitationId);

  const invitationDoc = await invitationRef.get();

  if (!invitationDoc.exists) {
    throw new Error('Invitation not found');
  }

  const invitation = invitationDoc.data() as OrgInvitation;

  if (invitation.status !== 'pending') {
    throw new Error(`Cannot cancel invitation with status: ${invitation.status}`);
  }

  await invitationRef.update({ status: 'cancelled' });

  // Log audit event
  await logAuditEvent({
    orgId,
    userId: cancelledBy,
    action: 'member.invited', // Could add a 'member.invitation_cancelled' action
    resourceType: 'invitation',
    resourceId: invitationId,
    metadata: { email: invitation.email, cancelled: true },
  });

  console.log(`[InvitationService] Cancelled invitation ${invitationId}`);
}

/**
 * Get invitation by ID
 */
export async function getInvitationById(
  orgId: string,
  invitationId: string
): Promise<OrgInvitation | null> {
  const db = getDb();

  const doc = await db
    .collection(COLLECTIONS.invitations(orgId))
    .doc(invitationId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as OrgInvitation;
}
