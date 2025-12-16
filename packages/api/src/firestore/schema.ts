/**
 * Firestore Schema Types
 *
 * Phase 1: Firestore-backed MVP Core
 * Phase 2: Email Alerts via Resend
 * Phase 4: Production SaaS Control Plane + Public API v1
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Beads Tasks: intentvision-002, intentvision-8aj, intentvision-p88, intentvision-p5
 *
 * Collection structure:
 * - organizations/{orgId}
 * - organizations/{orgId}/apiKeys/{keyId}
 * - organizations/{orgId}/sources/{sourceId}
 * - organizations/{orgId}/metrics/{metricId}
 * - organizations/{orgId}/timeseries/{seriesId}
 * - organizations/{orgId}/forecasts/{forecastId}
 * - organizations/{orgId}/alertRules/{ruleId}
 * - organizations/{orgId}/alertEvents/{eventId}
 * - organizations/{orgId}/usage/{date}
 * - users/{userId}
 */

// =============================================================================
// Organization
// =============================================================================

export type OrganizationPlan = 'beta' | 'starter' | 'growth' | 'enterprise';
export type OrganizationStatus = 'active' | 'suspended' | 'deleted';

export interface Organization {
  id: string;
  name: string;
  /** URL-safe identifier */
  slug: string;
  /** Billing plan */
  plan: OrganizationPlan;
  createdAt: Date;
  updatedAt: Date;
  status: OrganizationStatus;
  settings?: {
    defaultForecastHorizon?: number;
    defaultBackend?: 'statistical' | 'nixtla';
  };
  /** Contact email for the organization */
  contactEmail?: string;
}

// =============================================================================
// User (Phase 5)
// =============================================================================

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface User {
  id: string;
  /** Firebase Auth UID - links to Firebase Authentication */
  authUid: string;
  /** User email address */
  email: string;
  /** Display name (optional) */
  displayName?: string;
  /** Organization this user belongs to */
  organizationId: string;
  /** User's role within the organization */
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// API Key
// =============================================================================

/** API scopes for access control */
export type ApiScope =
  | 'ingest:write'      // POST /v1/events
  | 'metrics:read'      // GET /v1/metrics/*/forecasts
  | 'alerts:read'       // GET /v1/alerts
  | 'alerts:write'      // POST/PATCH/DELETE /v1/alerts
  | 'admin'             // Full access
  // Legacy scopes (Phase 1-2 compatibility)
  | 'ingest'
  | 'forecast'
  | 'read';

export type ApiKeyStatus = 'active' | 'revoked';

export interface ApiKey {
  id: string;
  orgId: string;
  /** Display name for the key */
  name: string;
  /** SHA-256 hash of the key - NEVER store raw key */
  hashedKey: string;
  /** First 8 chars for display/identification */
  keyPrefix: string;
  /** Authorized scopes */
  scopes: ApiScope[];
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  status: ApiKeyStatus;
  /** Rate limit per minute (0 = unlimited) */
  rateLimitPerMinute?: number;
}

// =============================================================================
// Source (Data Integration)
// =============================================================================

export type SourceType = 'stripe' | 'posthog' | 'segment' | 'webhook' | 'custom';
export type SourceStatus = 'pending' | 'active' | 'error' | 'disabled';

export interface Source {
  id: string;
  orgId: string;
  /** Type of data source */
  type: SourceType;
  /** Display name */
  name: string;
  /** Current status */
  status: SourceStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Non-sensitive configuration summary for UI */
  configSummary?: Record<string, unknown>;
  /** Last successful sync timestamp */
  lastSyncAt?: Date;
  /** Error message if status is 'error' */
  errorMessage?: string;
}

// =============================================================================
// Metric
// =============================================================================

export interface Metric {
  id: string;
  orgId: string;
  name: string;
  /** Human-readable display name */
  displayName?: string;
  description?: string;
  unit?: string;
  tags?: Record<string, string>;
  /** Source IDs this metric is derived from */
  sourceRefs?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastDataPoint?: Date;
  dataPointCount?: number;
  /** Whether this metric is actively being tracked */
  active?: boolean;
}

// =============================================================================
// Time Series
// =============================================================================

/**
 * Time series data stored as batched documents.
 * Each document contains up to 1000 points for a metric.
 */
export interface TimeSeriesDocument {
  id: string;
  orgId: string;
  metricId: string;
  metricName: string;
  /** Start timestamp of this batch */
  startTime: Date;
  /** End timestamp of this batch */
  endTime: Date;
  /** Array of data points */
  points: TimeSeriesPoint[];
  /** Number of points in this document */
  pointCount: number;
  createdAt: Date;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  /** Optional metadata per point */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Forecast
// =============================================================================

export interface Forecast {
  id: string;
  orgId: string;
  metricId: string;
  metricName: string;
  /** Number of periods forecasted */
  horizonDays: number;
  /** Backend used for this forecast */
  backend: 'statistical' | 'nixtla';
  /** Status of the forecast */
  status: 'pending' | 'completed' | 'failed';
  /** Forecast results */
  predictions: ForecastPoint[];
  /** Model information */
  modelInfo?: {
    name: string;
    version?: string;
    parameters?: Record<string, unknown>;
  };
  /** Metrics about the forecast */
  metrics?: {
    inputPoints: number;
    outputPoints: number;
    durationMs: number;
  };
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ForecastPoint {
  timestamp: Date;
  predictedValue: number;
  confidenceLower: number;
  confidenceUpper: number;
  /** Confidence level (e.g., 0.95 for 95%) */
  confidenceLevel: number;
}

// =============================================================================
// Alert Rules (Phase 2 + Phase 4 Channels)
// =============================================================================

export type AlertDirection = 'above' | 'below';
export type AlertType = 'threshold' | 'anomaly';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Notification channel types - user-configurable per alert
 * Phase 4: email implemented, others reserved for future
 */
export type NotificationChannelType = 'email' | 'slack' | 'webhook' | 'sms';

/**
 * User-configurable notification channel
 * Flexible structure to support multiple channel types
 */
export interface NotificationChannel {
  /** Channel type */
  type: NotificationChannelType;
  /** Email addresses (for email/sms) */
  to?: string[];
  /** Slack channel (e.g. "#alerts" or channel ID) */
  slackChannel?: string;
  /** Webhook URL (for webhook type) */
  webhookUrl?: string;
  /** Mark as primary notification channel */
  isPrimary?: boolean;
  /** Whether this channel is enabled */
  enabled?: boolean;
}

export interface AlertRule {
  id: string;
  orgId: string;
  /** Human-readable name for the alert */
  name: string;
  /** Optional description */
  description?: string;
  /** Alert type: threshold or anomaly-based */
  type: AlertType;
  /** Metric to monitor */
  metricName: string;
  /** Condition for threshold alerts */
  condition?: {
    /** Comparison operator */
    operator: 'gt' | 'lt' | 'gte' | 'lte';
    /** Threshold value */
    value: number;
  };
  /** Direction for forecast-based alerts (legacy, use condition for new) */
  direction?: AlertDirection;
  /** Threshold value (legacy, use condition for new) */
  threshold?: number;
  /** Severity threshold for anomaly alerts */
  severityThreshold?: AlertSeverity;
  /** Forecast horizon to monitor (default: 7 days) */
  horizonDays: number;
  /**
   * User-configurable notification channels
   * Customers can choose how they want to be notified
   */
  channels: NotificationChannel[];
  /** Legacy: single email recipient (Phase 2 compatibility) */
  email?: string;
  /** Whether rule is active */
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Alert Events (Phase 2 + Phase 4 Multi-Channel)
// =============================================================================

export type AlertDeliveryStatus = 'queued' | 'sent' | 'failed' | 'skipped';

/** Per-channel delivery result */
export interface ChannelDeliveryResult {
  /** Channel type */
  channelType: NotificationChannelType;
  /** Delivery status */
  status: AlertDeliveryStatus;
  /** Error message if failed */
  error?: string;
  /** External message ID (e.g., Resend ID) */
  externalId?: string;
  /** Recipients (emails or channel names) */
  recipients?: string[];
}

export interface AlertEvent {
  id: string;
  orgId: string;
  /** Rule that triggered this alert */
  ruleId: string;
  /** Metric that triggered */
  metricName: string;
  /** When the alert was triggered */
  triggeredAt: Date;
  /** Forecast value that triggered the alert */
  triggerValue: number;
  /** Threshold from the rule */
  threshold: number;
  /** Direction from the rule */
  direction?: AlertDirection;
  /** Condition that was evaluated */
  condition?: { operator: string; value: number };
  /** Overall delivery status (sent if any channel succeeded) */
  deliveryStatus: AlertDeliveryStatus;
  /** Per-channel delivery results */
  channelResults?: ChannelDeliveryResult[];
  /** Legacy: Email recipient (Phase 2 compatibility) */
  email?: string;
  /** Legacy: Error message if delivery failed */
  deliveryError?: string;
  /** Legacy: Resend message ID if sent */
  resendMessageId?: string;
}

// =============================================================================
// Usage Tracking (Phase 4)
// =============================================================================

export interface DailyUsage {
  /** Date in YYYY-MM-DD format */
  date: string;
  orgId: string;
  /** Number of events ingested */
  eventsIngested: number;
  /** Number of forecast requests */
  forecastsRequested: number;
  /** Number of alert emails sent */
  emailsSent: number;
  /** Number of API calls */
  apiCalls: number;
  updatedAt: Date;
}

// =============================================================================
// Collection Paths
// =============================================================================

export const COLLECTIONS = {
  organizations: 'organizations',
  users: 'users',
  apiKeys: (orgId: string) => `organizations/${orgId}/apiKeys`,
  sources: (orgId: string) => `organizations/${orgId}/sources`,
  metrics: (orgId: string) => `organizations/${orgId}/metrics`,
  timeseries: (orgId: string) => `organizations/${orgId}/timeseries`,
  forecasts: (orgId: string) => `organizations/${orgId}/forecasts`,
  alertRules: (orgId: string) => `organizations/${orgId}/alertRules`,
  alertEvents: (orgId: string) => `organizations/${orgId}/alertEvents`,
  usage: (orgId: string) => `organizations/${orgId}/usage`,
} as const;

// =============================================================================
// Request/Response Types
// =============================================================================

export interface IngestTimeseriesRequest {
  metricName: string;
  points: Array<{
    timestamp: string | number;
    value: number;
    metadata?: Record<string, unknown>;
  }>;
}

export interface IngestTimeseriesResponse {
  metricId: string;
  metricName: string;
  pointsIngested: number;
  duplicatesSkipped: number;
}

export interface RunForecastRequest {
  metricName: string;
  horizonDays?: number;
  backend?: 'statistical' | 'nixtla';
}

export interface RunForecastResponse {
  forecastId: string;
  metricName: string;
  horizonDays: number;
  backend: string;
  pointsGenerated: number;
  status: 'completed' | 'pending' | 'failed';
}

export interface GetForecastResponse {
  forecasts: Forecast[];
  total: number;
}

// =============================================================================
// Public API v1 Request/Response Types (Phase 4)
// =============================================================================

/** POST /v1/events - Ingest event data */
export interface IngestEventRequest {
  /** Data source identifier */
  source: string;
  /** Metric name */
  metric: string;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Numeric value */
  value: number;
  /** Optional dimensions for filtering/grouping */
  dimensions?: Record<string, string>;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface IngestEventResponse {
  status: 'queued' | 'accepted';
  eventId?: string;
}

/** GET /v1/metrics/:metricName/forecasts */
export interface GetMetricForecastsRequest {
  horizonDays?: number;
  from?: string;
  to?: string;
}

export interface GetMetricForecastsResponse {
  metric: string;
  horizonDays: number;
  points: Array<{
    timestamp: string;
    predicted: number;
    confidenceLower: number;
    confidenceUpper: number;
    confidenceScore: number;
  }>;
}

// =============================================================================
// Alert Rule Request/Response Types (Phase 2 + Phase 4 Channels)
// =============================================================================

/** POST /v1/alerts - Create alert with user-configurable channels */
export interface CreateAlertRuleRequest {
  /** Alert name */
  name: string;
  /** Optional description */
  description?: string;
  /** Alert type: threshold or anomaly */
  type?: AlertType;
  /** Metric to monitor */
  metricName: string;
  /** Condition for threshold alerts */
  condition?: {
    operator: 'gt' | 'lt' | 'gte' | 'lte';
    value: number;
  };
  /** Legacy: direction for forecast-based alerts */
  direction?: AlertDirection;
  /** Legacy: threshold value */
  threshold?: number;
  /** Severity threshold for anomaly alerts */
  severityThreshold?: AlertSeverity;
  /** Forecast horizon (days) */
  horizonDays?: number;
  /**
   * User-configurable notification channels
   * Customers choose how they want to be notified
   */
  channels?: NotificationChannel[];
  /** Legacy: single email recipient */
  email?: string;
  /** Whether rule is active */
  enabled?: boolean;
}

/** PATCH /v1/alerts/:id - Update alert */
export interface UpdateAlertRuleRequest {
  name?: string;
  description?: string;
  type?: AlertType;
  metricName?: string;
  condition?: {
    operator: 'gt' | 'lt' | 'gte' | 'lte';
    value: number;
  };
  direction?: AlertDirection;
  threshold?: number;
  severityThreshold?: AlertSeverity;
  horizonDays?: number;
  channels?: NotificationChannel[];
  email?: string;
  enabled?: boolean;
}

export interface AlertRuleResponse {
  alert: AlertRule;
}

export interface ListAlertRulesResponse {
  alerts: AlertRule[];
  total: number;
}

export interface EvaluateAlertsRequest {
  metricName?: string;
}

export interface EvaluateAlertsResponse {
  rulesEvaluated: number;
  rulesTriggered: number;
  results: Array<{
    ruleId: string;
    metricName: string;
    triggered: boolean;
    triggerValue?: number;
    threshold: number;
    direction?: AlertDirection;
    condition?: { operator: string; value: number };
    /** Per-channel delivery status */
    channelResults?: Array<{
      type: NotificationChannelType;
      sent: boolean;
      error?: string;
    }>;
    /** Legacy: overall email sent status */
    emailSent?: boolean;
    error?: string;
  }>;
}

// =============================================================================
// API Error Response
// =============================================================================

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
