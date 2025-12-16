/**
 * Notification Preferences Store - Firestore Adapter
 *
 * Phase 8: Notification Preferences + Multi-Channel Alerts
 * Beads Task: intentvision-8xq
 *
 * Stores and retrieves notification channel configurations and preferences
 * from Cloud Firestore. Uses environment-prefixed collections for isolation.
 *
 * Collections:
 * - envs/{env}/orgs/{orgId}/notificationChannels/{channelId}
 * - envs/{env}/orgs/{orgId}/notificationPreferences/{preferenceId}
 */

import { getDb, getEnvCollection, generateId } from '../firestore/client.js';

// =============================================================================
// Types
// =============================================================================

export type NotificationChannelType = 'email' | 'slack_webhook' | 'http_webhook' | 'pagerduty';

export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Configuration for a notification channel (email, slack, webhook, etc.)
 */
export interface NotificationChannelConfig {
  /** Unique channel ID */
  id: string;
  /** Organization ID that owns this channel */
  orgId: string;
  /** Channel type */
  type: NotificationChannelType;
  /** Whether channel is enabled */
  enabled: boolean;
  /** Human-readable name/description */
  name?: string;
  /** Additional description */
  description?: string;

  // Channel-specific configuration
  /** Email address (for 'email' type) */
  emailAddress?: string;
  /** Slack webhook URL (for 'slack_webhook' type) */
  slackWebhookUrl?: string;
  /** HTTP webhook URL (for 'http_webhook' type) */
  httpWebhookUrl?: string;
  /** PagerDuty routing key (for 'pagerduty' type) */
  pagerDutyRoutingKey?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Notification preference - links severity levels to channels
 */
export interface NotificationPreference {
  /** Unique preference ID */
  id: string;
  /** Organization ID */
  orgId: string;
  /** Optional user ID for per-user preferences */
  userId?: string | null;
  /** Optional metric key pattern (e.g., "stripe:*" or "sentry:errors") */
  metricKey?: string | null;
  /** Severity level to match */
  severity: AlertSeverity;
  /** Array of channel IDs to notify */
  channels: string[];
  /** Whether this preference is enabled */
  enabled: boolean;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Alert event structure passed to the dispatcher
 */
export interface AlertEvent {
  orgId: string;
  metricKey: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  occurredAt: string;
}

// =============================================================================
// Firestore Collection Helpers
// =============================================================================

/**
 * Get the Firestore collection reference for notification channels
 */
function getChannelsCollection(orgId: string) {
  const db = getDb();
  const path = getEnvCollection(`orgs/${orgId}/notificationChannels`);
  return db.collection(path);
}

/**
 * Get the Firestore collection reference for notification preferences
 */
function getPreferencesCollection(orgId: string) {
  const db = getDb();
  const path = getEnvCollection(`orgs/${orgId}/notificationPreferences`);
  return db.collection(path);
}

// =============================================================================
// Notification Channel Operations
// =============================================================================

/**
 * List all notification channels for an organization
 */
export async function listNotificationChannelsForOrg(
  orgId: string
): Promise<NotificationChannelConfig[]> {
  const collection = getChannelsCollection(orgId);
  const snapshot = await collection.orderBy('createdAt', 'desc').get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NotificationChannelConfig[];
}

/**
 * Get a specific notification channel by ID
 */
export async function getNotificationChannel(
  orgId: string,
  channelId: string
): Promise<NotificationChannelConfig | null> {
  const collection = getChannelsCollection(orgId);
  const doc = await collection.doc(channelId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as NotificationChannelConfig;
}

/**
 * Get multiple notification channels by their IDs
 */
export async function getNotificationChannelsByIds(
  orgId: string,
  channelIds: string[]
): Promise<NotificationChannelConfig[]> {
  if (channelIds.length === 0) {
    return [];
  }

  const collection = getChannelsCollection(orgId);
  const channels: NotificationChannelConfig[] = [];

  // Firestore 'in' queries have a limit of 30 items
  const batches = [];
  for (let i = 0; i < channelIds.length; i += 30) {
    batches.push(channelIds.slice(i, i + 30));
  }

  for (const batch of batches) {
    const snapshot = await collection.where('__name__', 'in', batch).get();
    for (const doc of snapshot.docs) {
      channels.push({
        id: doc.id,
        ...doc.data(),
      } as NotificationChannelConfig);
    }
  }

  return channels;
}

/**
 * Create or update a notification channel
 */
export async function upsertNotificationChannel(
  orgId: string,
  channel: Partial<NotificationChannelConfig>
): Promise<NotificationChannelConfig> {
  const collection = getChannelsCollection(orgId);
  const now = new Date().toISOString();

  const channelId = channel.id || generateId('ch');
  const docRef = collection.doc(channelId);
  const existing = await docRef.get();

  const data: NotificationChannelConfig = {
    id: channelId,
    orgId,
    type: channel.type || 'email',
    enabled: channel.enabled ?? true,
    name: channel.name,
    description: channel.description,
    emailAddress: channel.emailAddress,
    slackWebhookUrl: channel.slackWebhookUrl,
    httpWebhookUrl: channel.httpWebhookUrl,
    pagerDutyRoutingKey: channel.pagerDutyRoutingKey,
    createdAt: existing.exists
      ? (existing.data()?.createdAt as string) || now
      : now,
    updatedAt: now,
  };

  await docRef.set(data, { merge: true });

  return data;
}

/**
 * Delete a notification channel
 */
export async function deleteNotificationChannel(
  orgId: string,
  channelId: string
): Promise<boolean> {
  const collection = getChannelsCollection(orgId);
  await collection.doc(channelId).delete();
  return true;
}

// =============================================================================
// Notification Preference Operations
// =============================================================================

/**
 * List all notification preferences for an organization
 */
export async function listNotificationPreferencesForOrg(
  orgId: string
): Promise<NotificationPreference[]> {
  const collection = getPreferencesCollection(orgId);
  const snapshot = await collection.orderBy('createdAt', 'desc').get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NotificationPreference[];
}

/**
 * Get a specific notification preference by ID
 */
export async function getNotificationPreference(
  orgId: string,
  preferenceId: string
): Promise<NotificationPreference | null> {
  const collection = getPreferencesCollection(orgId);
  const doc = await collection.doc(preferenceId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as NotificationPreference;
}

/**
 * Find notification preferences matching an alert event
 *
 * Matching logic:
 * 1. Must match orgId
 * 2. Severity must match OR preference has 'critical' severity (always notified)
 * 3. If metricKey is specified in preference, it must match (supports wildcards)
 * 4. Preference must be enabled
 */
export async function findMatchingPreferences(params: {
  orgId: string;
  metricKey: string;
  severity: AlertSeverity;
}): Promise<NotificationPreference[]> {
  const { orgId, metricKey, severity } = params;
  const collection = getPreferencesCollection(orgId);

  // Query for preferences that match the severity or are set to match all
  // Note: Firestore doesn't support OR queries, so we fetch enabled preferences
  // and filter in memory
  const snapshot = await collection
    .where('enabled', '==', true)
    .get();

  const allPreferences = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NotificationPreference[];

  // Filter to matching preferences
  return allPreferences.filter((pref) => {
    // Check severity match
    const severityMatch = pref.severity === severity ||
      // Critical alerts also trigger warning preferences
      (severity === 'critical' && pref.severity === 'warning');

    if (!severityMatch) {
      return false;
    }

    // Check metric key match (if specified)
    if (pref.metricKey) {
      // Support wildcard patterns like "stripe:*"
      if (pref.metricKey.endsWith('*')) {
        const prefix = pref.metricKey.slice(0, -1);
        if (!metricKey.startsWith(prefix)) {
          return false;
        }
      } else if (pref.metricKey !== metricKey) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Create or update a notification preference
 */
export async function upsertNotificationPreference(
  orgId: string,
  pref: Partial<NotificationPreference>
): Promise<NotificationPreference> {
  const collection = getPreferencesCollection(orgId);
  const now = new Date().toISOString();

  const preferenceId = pref.id || generateId('pref');
  const docRef = collection.doc(preferenceId);
  const existing = await docRef.get();

  const data: NotificationPreference = {
    id: preferenceId,
    orgId,
    userId: pref.userId ?? null,
    metricKey: pref.metricKey ?? null,
    severity: pref.severity || 'warning',
    channels: pref.channels || [],
    enabled: pref.enabled ?? true,
    createdAt: existing.exists
      ? (existing.data()?.createdAt as string) || now
      : now,
    updatedAt: now,
  };

  await docRef.set(data, { merge: true });

  return data;
}

/**
 * Delete a notification preference
 */
export async function deleteNotificationPreference(
  orgId: string,
  preferenceId: string
): Promise<boolean> {
  const collection = getPreferencesCollection(orgId);
  await collection.doc(preferenceId).delete();
  return true;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Get all enabled channels for an alert based on preferences
 *
 * 1. Find matching preferences
 * 2. Collect unique channel IDs
 * 3. Fetch channel configs
 * 4. Filter to enabled channels
 */
export async function getChannelsForAlert(
  alert: AlertEvent
): Promise<NotificationChannelConfig[]> {
  // Find matching preferences
  const preferences = await findMatchingPreferences({
    orgId: alert.orgId,
    metricKey: alert.metricKey,
    severity: alert.severity,
  });

  if (preferences.length === 0) {
    return [];
  }

  // Collect unique channel IDs
  const channelIds = new Set<string>();
  for (const pref of preferences) {
    for (const channelId of pref.channels) {
      channelIds.add(channelId);
    }
  }

  if (channelIds.size === 0) {
    return [];
  }

  // Fetch channel configurations
  const channels = await getNotificationChannelsByIds(
    alert.orgId,
    Array.from(channelIds)
  );

  // Filter to enabled channels only
  return channels.filter((ch) => ch.enabled);
}

/**
 * Ensure a test channel and preference exist for an org
 * Used for testing alert dispatch
 */
export async function ensureTestChannelAndPreference(
  orgId: string,
  emailAddress: string
): Promise<{
  channel: NotificationChannelConfig;
  preference: NotificationPreference;
}> {
  // Check if test channel exists
  const channels = await listNotificationChannelsForOrg(orgId);
  let testChannel = channels.find(
    (ch) => ch.type === 'email' && ch.description === 'Phase 8 test'
  );

  if (!testChannel) {
    testChannel = await upsertNotificationChannel(orgId, {
      type: 'email',
      enabled: true,
      name: 'Test Email Channel',
      description: 'Phase 8 test',
      emailAddress,
    });
  }

  // Check if test preference exists
  const preferences = await listNotificationPreferencesForOrg(orgId);
  let testPreference = preferences.find(
    (p) => p.channels.includes(testChannel!.id)
  );

  if (!testPreference) {
    testPreference = await upsertNotificationPreference(orgId, {
      severity: 'warning',
      channels: [testChannel.id],
      enabled: true,
    });
  }

  return {
    channel: testChannel,
    preference: testPreference,
  };
}
