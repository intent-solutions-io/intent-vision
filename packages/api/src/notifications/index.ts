/**
 * Notifications Module
 *
 * Phase 8: Notification Preferences + Multi-Channel Alerts
 *
 * Exports all notification-related functionality:
 * - Firestore-backed notification preferences and channels
 * - Alert dispatcher with multi-channel support
 * - Resend email client
 */

// Notification Preferences Store (Firestore)
export {
  // Types
  type NotificationChannelType,
  type AlertSeverity,
  type NotificationChannelConfig,
  type NotificationPreference,
  type AlertEvent,

  // Channel Operations
  listNotificationChannelsForOrg,
  getNotificationChannel,
  getNotificationChannelsByIds,
  upsertNotificationChannel,
  deleteNotificationChannel,

  // Preference Operations
  listNotificationPreferencesForOrg,
  getNotificationPreference,
  findMatchingPreferences,
  upsertNotificationPreference,
  deleteNotificationPreference,

  // Convenience Functions
  getChannelsForAlert,
  ensureTestChannelAndPreference,
} from './notification-preferences.store.js';

// Alert Dispatcher
export {
  type DispatchResult,
  type AlertDispatchSummary,
  dispatchAlert,
  getDispatcherStatus,
} from './alert-dispatcher.js';

// Resend Email Client
export {
  type SendEmailOptions,
  type SendEmailResult,
  isResendConfigured,
  getFromEmail,
  sendResendEmail,
  formatAlertEmailHtml,
  formatAlertEmailText,
} from './resend-client.js';
