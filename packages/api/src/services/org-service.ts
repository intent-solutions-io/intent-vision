/**
 * Organization Service
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Beads Task: intentvision-p5
 *
 * CRUD operations for organizations and users.
 * Handles multi-tenant data isolation.
 */

import { getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type Organization,
  type OrganizationPlan,
  type User,
  type UserRole,
} from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

export interface CreateOrganizationParams {
  name: string;
  slug: string;
  plan?: OrganizationPlan;
  contactEmail?: string;
}

export interface CreateUserParams {
  authUid: string;
  email: string;
  displayName?: string;
  organizationId: string;
  role?: UserRole;
}

export interface UpdateOrganizationParams {
  name?: string;
  slug?: string;
  plan?: OrganizationPlan;
  contactEmail?: string;
  status?: 'active' | 'suspended' | 'deleted';
}

// =============================================================================
// Organization Operations
// =============================================================================

/**
 * Create a new organization
 */
export async function createOrganization(
  params: CreateOrganizationParams
): Promise<Organization> {
  const db = getDb();
  const orgId = generateId('org');
  const now = new Date();

  const org: Organization = {
    id: orgId,
    name: params.name,
    slug: params.slug,
    plan: params.plan || 'beta',
    createdAt: now,
    updatedAt: now,
    status: 'active',
    contactEmail: params.contactEmail,
  };

  await db.collection(COLLECTIONS.organizations).doc(orgId).set(org);
  console.log(`[OrgService] Created organization: ${orgId}`);

  return org;
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(
  orgId: string
): Promise<Organization | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTIONS.organizations).doc(orgId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as Organization;
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(
  slug: string
): Promise<Organization | null> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.organizations)
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as Organization;
}

/**
 * Update organization
 */
export async function updateOrganization(
  orgId: string,
  updates: UpdateOrganizationParams
): Promise<Organization | null> {
  const db = getDb();
  const docRef = db.collection(COLLECTIONS.organizations).doc(orgId);

  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }

  const updateData = {
    ...updates,
    updatedAt: new Date(),
  };

  await docRef.update(updateData);

  const updated = await docRef.get();
  return updated.data() as Organization;
}

/**
 * List all organizations (for internal use)
 */
export async function listOrganizations(
  limit = 100
): Promise<Organization[]> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.organizations)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => doc.data() as Organization);
}

// =============================================================================
// User Operations
// =============================================================================

/**
 * Create a new user
 */
export async function createUser(params: CreateUserParams): Promise<User> {
  const db = getDb();
  const userId = generateId('user');
  const now = new Date();

  const user: User = {
    id: userId,
    authUid: params.authUid,
    email: params.email,
    displayName: params.displayName,
    organizationId: params.organizationId,
    role: params.role || 'member',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.users).doc(userId).set(user);
  console.log(`[OrgService] Created user: ${userId} for org: ${params.organizationId}`);

  return user;
}

/**
 * Get user by Firebase Auth UID
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

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTIONS.users).doc(userId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as User;
}

/**
 * Get all users for an organization
 */
export async function getUsersByOrganization(
  organizationId: string
): Promise<User[]> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.users)
    .where('organizationId', '==', organizationId)
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => doc.data() as User);
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<User | null> {
  const db = getDb();
  const docRef = db.collection(COLLECTIONS.users).doc(userId);

  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }

  await docRef.update({
    role,
    updatedAt: new Date(),
  });

  const updated = await docRef.get();
  return updated.data() as User;
}

// =============================================================================
// Onboarding - Combined Org + User Creation
// =============================================================================

export interface OnboardingParams {
  orgName: string;
  orgSlug: string;
  userAuthUid: string;
  userEmail: string;
  userDisplayName?: string;
}

export interface OnboardingResult {
  organization: Organization;
  user: User;
}

/**
 * Create organization and owner user in a single operation
 * Used during customer onboarding flow
 */
export async function createOnboardedOrganization(
  params: OnboardingParams
): Promise<OnboardingResult> {
  // Create the organization first
  const organization = await createOrganization({
    name: params.orgName,
    slug: params.orgSlug,
    plan: 'beta',
    contactEmail: params.userEmail,
  });

  // Create the owner user
  const user = await createUser({
    authUid: params.userAuthUid,
    email: params.userEmail,
    displayName: params.userDisplayName,
    organizationId: organization.id,
    role: 'owner',
  });

  console.log(`[OrgService] Onboarding complete: org=${organization.id}, user=${user.id}`);

  return { organization, user };
}
