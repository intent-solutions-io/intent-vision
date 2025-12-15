/**
 * Alert Module
 *
 * Task ID: intentvision-9ru
 *
 * Exports all alerting functionality:
 * - Rules engine for condition evaluation
 * - Notification channels (webhook, email, slack, pagerduty)
 * - Deduplication and suppression
 * - Lifecycle management
 */

// Rules Engine
export {
  RulesEngine,
  getRulesEngine,
  resetRulesEngine,
  createRulesEngine,
  type RuleEvaluationContext,
  type RuleEvaluationResult,
  type RulesEngineConfig,
} from './rules-engine.js';

// Notification Channels
export {
  NotificationChannel,
  WebhookChannel,
  EmailChannel,
  SlackChannel,
  PagerDutyChannel,
  NotificationDispatcher,
  getNotificationDispatcher,
  resetNotificationDispatcher,
  type NotificationResult,
  type NotificationPayload,
  type ChannelConfig,
  type EmailConfig,
  type SlackConfig,
  type PagerDutyConfig,
} from './notification-channels.js';

// Deduplication and Suppression
export {
  DeduplicationManager,
  SuppressionManager,
  AlertFilter,
  getAlertFilter,
  resetAlertFilter,
  type DedupConfig,
  type DedupResult,
  type SuppressionResult,
} from './deduplication.js';

// Lifecycle Management
export {
  AlertLifecycleManager,
  getAlertLifecycleManager,
  resetAlertLifecycleManager,
  type AlertStatus,
  type AlertState,
  type LifecycleConfig,
  type StateTransition,
} from './lifecycle.js';
