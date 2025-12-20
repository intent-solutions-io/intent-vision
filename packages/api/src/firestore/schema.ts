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
// Organization Invitations (Phase 15)
// =============================================================================

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface OrgInvitation {
  id: string;
  /** Organization ID */
  orgId: string;
  /** Email address of invitee */
  email: string;
  /** Role to be granted upon acceptance */
  role: UserRole;
  /** Unique token for invitation link */
  token: string;
  /** Invitation status */
  status: InvitationStatus;
  /** User ID who sent the invitation */
  invitedBy: string;
  /** When the invitation was sent */
  invitedAt: Date;
  /** When the invitation expires */
  expiresAt: Date;
  /** When the invitation was accepted (if applicable) */
  acceptedAt?: Date;
}

// =============================================================================
// Audit Logs (Phase 15)
// =============================================================================

export type AuditAction =
  | 'member.invited'
  | 'member.joined'
  | 'member.removed'
  | 'member.role_changed'
  | 'api_key.created'
  | 'api_key.deleted'
  | 'alert.created'
  | 'alert.updated'
  | 'alert.deleted'
  | 'source.connected'
  | 'source.disconnected'
  | 'settings.changed';

export interface AuditLog {
  id: string;
  /** Organization ID */
  orgId: string;
  /** User who performed the action */
  userId: string;
  /** Action performed */
  action: AuditAction;
  /** Type of resource affected */
  resourceType: string;
  /** ID of the resource affected */
  resourceId: string;
  /** Additional metadata about the action */
  metadata?: Record<string, unknown>;
  /** IP address of the request */
  ipAddress?: string;
  /** User agent of the request */
  userAgent?: string;
  /** When the action occurred */
  createdAt: Date;
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
export type ApiKeyMode = 'sandbox' | 'production';

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
  /** Key mode: sandbox (non-billable, limited) or production */
  mode: ApiKeyMode;
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
// Usage Tracking (Phase 4 + Phase 11)
// =============================================================================

/**
 * Usage event types for metering
 * Phase 11: Granular usage tracking for billing and plan enforcement
 */
export type UsageEventType =
  | 'forecast_call'      // POST /v1/forecast/run
  | 'alert_fired'        // Alert notification sent
  | 'metric_ingested'    // Data points ingested
  | 'api_call';          // General API calls

/**
 * Individual usage event for metering
 * Phase 11: Detailed ledger for billing and plan enforcement
 */
export interface UsageEvent {
  id: string;
  orgId: string;
  planId: string;
  userId?: string;
  eventType: UsageEventType;
  /** Quantity (typically 1, but can be higher for batch operations) */
  quantity: number;
  /** When the event occurred */
  occurredAt: Date;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated usage for a time period
 * Phase 11: Pre-computed aggregates for dashboard and billing
 */
export interface UsageAggregate {
  orgId: string;
  planId: string;
  /** Period start (inclusive) */
  periodStart: Date;
  /** Period end (exclusive) */
  periodEnd: Date;
  /** Counts by event type */
  counts: Record<UsageEventType, number>;
  /** Total events */
  totalEvents: number;
  /** When this aggregate was last computed */
  computedAt: Date;
}

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
// Billing Snapshots (Phase 12)
// =============================================================================

/**
 * Billing snapshot for a billing period
 * Phase 12: Billing backend for future Stripe integration
 */
export interface BillingSnapshot {
  id: string;
  orgId: string;
  planId: string;
  /** Billing period start (inclusive) */
  periodStart: Date;
  /** Billing period end (exclusive) */
  periodEnd: Date;
  /** Usage totals for the period */
  totals: {
    forecast_calls: number;
    alerts_fired: number;
    metrics_ingested: number;
  };
  /** When this snapshot was created */
  createdAt: Date;
}

// =============================================================================
// Project (Phase 14)
// =============================================================================

export type ProjectStatus = 'active' | 'archived' | 'deleted';

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  /** Whether sample data has been loaded for demo */
  sampleDataLoaded: boolean;
  /** Whether first forecast has been completed */
  firstForecastCompleted: boolean;
  /** ID of the first forecast if completed */
  firstForecastId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Onboarding Progress (Phase 14)
// =============================================================================

export type OnboardingStep = 'org_setup' | 'project_creation' | 'connect_source' | 'first_forecast' | 'completed';

export interface OnboardingProgress {
  id: string;
  orgId: string;
  /** Current step in onboarding */
  currentStep: OnboardingStep;
  /** Completed steps */
  completedSteps: OnboardingStep[];
  /** When onboarding started */
  startedAt: Date;
  /** When onboarding was completed */
  completedAt?: Date;
  /** Project ID created during onboarding */
  projectId?: string;
  updatedAt: Date;
}

// =============================================================================
// Backend Usage Tracking (Phase 18)
// =============================================================================

/**
 * Track daily usage of premium forecast backends
 * Phase 18: Plan-aware cost guardrails
 */
export interface BackendUsage {
  /** Organization ID */
  orgId: string;
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Statistical backend calls (always free, no limit) */
  statistical: number;
  /** Nixtla/TimeGPT backend calls */
  nixtla: number;
  /** LLM-based forecast calls */
  llm: number;
  /** When this record was last updated */
  updatedAt: Date;
}

// =============================================================================
// Alert Incidents (Phase 16)
// =============================================================================

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

/**
 * Alert Incident - Groups related alerts for smarter correlation
 * Phase 16: Smarter Alerts - Correlation & Grouping
 */
export interface AlertIncident {
  id: string;
  orgId: string;
  /** Human-readable title */
  title: string;
  /** Auto-generated summary */
  summary?: string;
  status: IncidentStatus;
  /** First alert timestamp */
  startedAt: Date;
  /** When resolved */
  resolvedAt?: Date;
  /** Related alert event IDs */
  alertEventIds: string[];
  /** Related metric names */
  relatedMetrics: string[];
  /** Root cause hints (metric IDs that may be causing others) */
  rootCauseHints?: string[];
  /** Correlation metadata */
  correlationMetadata?: {
    timeWindowMinutes: number;
    sharedTags?: string[];
  };
  createdAt: Date;
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
  /** Phase 11: Individual usage events for metering */
  usageEvents: (orgId: string) => `organizations/${orgId}/usageEvents`,
  /** Phase 12: Billing snapshots for billing periods */
  billingSnapshots: (orgId: string) => `organizations/${orgId}/billingSnapshots`,
  /** Phase 14: Projects for customer onboarding */
  projects: (orgId: string) => `organizations/${orgId}/projects`,
  /** Phase 14: Onboarding progress tracking */
  onboardingProgress: (orgId: string) => `organizations/${orgId}/onboardingProgress`,
  /** Phase 15: Organization invitations for team access */
  invitations: (orgId: string) => `organizations/${orgId}/invitations`,
  /** Phase 15: Audit logs for team actions */
  auditLogs: (orgId: string) => `organizations/${orgId}/auditLogs`,
  /** Phase 16: Alert incidents for correlation and grouping */
  incidents: (orgId: string) => `organizations/${orgId}/incidents`,
  /** Phase 18: Backend-specific usage tracking */
  backendUsage: (orgId: string) => `organizations/${orgId}/backendUsage`,
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
