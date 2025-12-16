/**
 * User Preferences Service
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-s4z
 *
 * Manages per-user notification preferences stored in Firestore.
 * Provides fallback to tenant-level defaults when user prefs unset.
 */

import { getDb } from '../firestore/client.js';
import { getUserById } from './org-service.js';

// =============================================================================
// Types
// =============================================================================

export interface EmailPreferences {
  enabled: boolean;
  address?: string;
}

export interface SlackPreferences {
  enabled: boolean;
  webhookUrl?: string;
}

export interface WebhookPreferences {
  enabled: boolean;
  url?: string;
  /** Optional secret for webhook verification */
  secret?: string;
}

export interface UserNotificationPreferences {
  userId: string;
  email: EmailPreferences;
  slack: SlackPreferences;
  webhook: WebhookPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdatePreferencesRequest {
  email?: Partial<EmailPreferences>;
  slack?: Partial<SlackPreferences>;
  webhook?: Partial<WebhookPreferences>;
}

// =============================================================================
// Collection Path
// =============================================================================

const PREFERENCES_COLLECTION = 'users';
const PREFERENCES_SUBCOLLECTION = 'preferences';
const NOTIFICATIONS_DOC = 'notifications';

function getPreferencesPath(userId: string): string {
  return `${PREFERENCES_COLLECTION}/${userId}/${PREFERENCES_SUBCOLLECTION}`;
}

// =============================================================================
// Default Preferences
// =============================================================================

/**
 * Get default notification preferences for a user
 */
export function getDefaultPreferences(userId: string, userEmail?: string): UserNotificationPreferences {
  const now = new Date();
  return {
    userId,
    email: {
      enabled: true,
      address: userEmail,
    },
    slack: {
      enabled: false,
    },
    webhook: {
      enabled: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Get notification preferences for a user
 * Returns defaults if not set
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const db = getDb();

  const doc = await db
    .collection(getPreferencesPath(userId))
    .doc(NOTIFICATIONS_DOC)
    .get();

  if (!doc.exists) {
    // Get user to populate default email
    const user = await getUserById(userId);
    return getDefaultPreferences(userId, user?.email);
  }

  return {
    userId,
    ...doc.data(),
  } as UserNotificationPreferences;
}

/**
 * Create or update notification preferences for a user
 */
export async function upsertUserNotificationPreferences(
  userId: string,
  updates: UpdatePreferencesRequest
): Promise<UserNotificationPreferences> {
  const db = getDb();
  const docRef = db.collection(getPreferencesPath(userId)).doc(NOTIFICATIONS_DOC);

  // Get existing preferences or defaults
  const existing = await getUserNotificationPreferences(userId);

  // Merge updates
  const updated: UserNotificationPreferences = {
    ...existing,
    email: {
      ...existing.email,
      ...updates.email,
    },
    slack: {
      ...existing.slack,
      ...updates.slack,
    },
    webhook: {
      ...existing.webhook,
      ...updates.webhook,
    },
    updatedAt: new Date(),
  };

  // Validate email address if provided
  if (updated.email.address) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updated.email.address)) {
      throw new Error('Invalid email address format');
    }
  }

  // Validate webhook URL if enabled
  if (updated.webhook.enabled && updated.webhook.url) {
    try {
      new URL(updated.webhook.url);
    } catch {
      throw new Error('Invalid webhook URL');
    }
  }

  // Validate Slack webhook URL if enabled
  if (updated.slack.enabled && updated.slack.webhookUrl) {
    try {
      new URL(updated.slack.webhookUrl);
    } catch {
      throw new Error('Invalid Slack webhook URL');
    }
  }

  await docRef.set(updated);

  console.log(`[UserPreferences] Updated preferences for user: ${userId}`);

  return updated;
}

/**
 * Delete notification preferences for a user (resets to defaults)
 */
export async function deleteUserNotificationPreferences(
  userId: string
): Promise<void> {
  const db = getDb();

  await db
    .collection(getPreferencesPath(userId))
    .doc(NOTIFICATIONS_DOC)
    .delete();

  console.log(`[UserPreferences] Deleted preferences for user: ${userId}`);
}

// =============================================================================
// Notification Resolution
// =============================================================================

export interface ResolvedNotificationConfig {
  /** Whether to send email */
  emailEnabled: boolean;
  /** Email address to use */
  emailAddress?: string;
  /** Whether to send Slack notification */
  slackEnabled: boolean;
  /** Slack webhook URL */
  slackWebhookUrl?: string;
  /** Whether to send webhook notification */
  webhookEnabled: boolean;
  /** Webhook URL */
  webhookUrl?: string;
  /** Source of preferences */
  source: 'user' | 'default';
}

/**
 * Resolve notification configuration for a user
 * Applies user preferences with tenant defaults as fallback
 */
export async function resolveNotificationConfig(
  userId: string
): Promise<ResolvedNotificationConfig> {
  const prefs = await getUserNotificationPreferences(userId);

  // Determine if using user-set or defaults
  const isDefault = !prefs.createdAt || prefs.createdAt.getTime() === prefs.updatedAt.getTime();

  return {
    emailEnabled: prefs.email.enabled,
    emailAddress: prefs.email.address,
    slackEnabled: prefs.slack.enabled,
    slackWebhookUrl: prefs.slack.webhookUrl,
    webhookEnabled: prefs.webhook.enabled,
    webhookUrl: prefs.webhook.url,
    source: isDefault ? 'default' : 'user',
  };
}

/**
 * Check if user has any notification channel enabled
 */
export async function hasAnyNotificationEnabled(userId: string): Promise<boolean> {
  const config = await resolveNotificationConfig(userId);
  return config.emailEnabled || config.slackEnabled || config.webhookEnabled;
}
