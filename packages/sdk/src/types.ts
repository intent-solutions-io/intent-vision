/**
 * TypeScript SDK Type Definitions
 *
 * Phase 19: Developer Experience - OpenAPI, SDK, and Sandbox Keys
 *
 * Type definitions matching the IntentVision OpenAPI specification.
 */

// =============================================================================
// Events
// =============================================================================

export interface IngestEventParams {
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

// =============================================================================
// Forecasts
// =============================================================================

export interface GetForecastOptions {
  horizonDays?: number;
  from?: string;
  to?: string;
}

export interface ForecastPoint {
  timestamp: string;
  predicted: number;
  confidenceLower: number;
  confidenceUpper: number;
  confidenceScore: number;
}

export interface ForecastResponse {
  metric: string;
  horizonDays: number;
  points: ForecastPoint[];
}

export interface RunForecastParams {
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
  sandbox?: boolean;
}

// =============================================================================
// Alerts
// =============================================================================

export type AlertType = 'threshold' | 'anomaly';
export type NotificationChannelType = 'email' | 'slack' | 'webhook' | 'sms';

export interface NotificationChannel {
  type: NotificationChannelType;
  to?: string[];
  slackChannel?: string;
  webhookUrl?: string;
  enabled?: boolean;
}

export interface AlertCondition {
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  value: number;
}

export interface CreateAlertParams {
  name: string;
  description?: string;
  type?: AlertType;
  metricName: string;
  condition?: AlertCondition;
  horizonDays?: number;
  channels: NotificationChannel[];
  enabled?: boolean;
}

export interface UpdateAlertParams {
  name?: string;
  description?: string;
  type?: AlertType;
  metricName?: string;
  condition?: AlertCondition;
  horizonDays?: number;
  channels?: NotificationChannel[];
  enabled?: boolean;
}

export interface AlertRule {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  type: AlertType;
  metricName: string;
  condition?: AlertCondition;
  horizonDays: number;
  channels: NotificationChannel[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Metrics
// =============================================================================

export interface Metric {
  id: string;
  orgId: string;
  name: string;
  displayName?: string;
  description?: string;
  unit?: string;
  tags?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastDataPoint?: string;
  dataPointCount?: number;
}

export interface TimeseriesOptions {
  from?: string;
  to?: string;
  limit?: number;
}

export interface TimeseriesPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface TimeseriesData {
  metricName: string;
  points: TimeseriesPoint[];
  total: number;
}

// =============================================================================
// Organization
// =============================================================================

export type OrganizationPlan = 'beta' | 'starter' | 'growth' | 'enterprise';
export type OrganizationStatus = 'active' | 'suspended' | 'deleted';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  status: OrganizationStatus;
  createdAt: string;
}

// =============================================================================
// API Response Wrappers
// =============================================================================

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class IntentVisionError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly requestId?: string;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(message);
    this.name = 'IntentVisionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
  }
}
