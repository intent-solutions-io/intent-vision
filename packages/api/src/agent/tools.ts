/**
 * Agent Tools
 *
 * Phase 17: Operator Assistant Agent
 *
 * Tools that agents can use to query data and perform actions.
 * Each tool is a simple function that interacts with the database.
 *
 * Available tools:
 * - get_incident: Get incident details by ID
 * - list_incident_alerts: List alerts in an incident
 * - list_related_metrics: Get metrics related to an incident
 * - get_metric_timeseries: Get recent time series data for a metric
 * - get_forecast: Get latest forecast for a metric
 */

import { getDb } from '../firestore/client.js';
import {
  COLLECTIONS,
  type AlertIncident,
  type AlertEvent,
  type Metric,
  type Forecast,
  type TimeSeriesDocument,
  type TimeSeriesPoint,
} from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Tool result wrapper
 */
export interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Incident details with enriched context
 */
export interface IncidentDetails {
  incident: AlertIncident;
  alertCount: number;
  metricCount: number;
  durationMinutes: number | null;
  isResolved: boolean;
}

/**
 * Alert summary for display
 */
export interface AlertSummary {
  id: string;
  metricName: string;
  triggeredAt: Date;
  triggerValue: number;
  threshold: number;
  direction?: string;
  condition?: { operator: string; value: number };
  deliveryStatus: string;
}

/**
 * Metric with recent statistics
 */
export interface MetricWithStats {
  metric: Metric;
  recentPointCount: number;
  latestValue?: number;
  latestTimestamp?: Date;
  minValue?: number;
  maxValue?: number;
  avgValue?: number;
}

/**
 * Time series window options
 */
export type TimeWindow = '1h' | '6h' | '24h' | '7d' | '30d';

/**
 * Time series data point
 */
export interface DataPoint {
  timestamp: string;
  value: number;
}

/**
 * Forecast summary
 */
export interface ForecastSummary {
  id: string;
  metricName: string;
  horizonDays: number;
  backend: string;
  status: string;
  createdAt: Date;
  predictions: Array<{
    timestamp: string;
    predictedValue: number;
    confidenceLower: number;
    confidenceUpper: number;
  }>;
  summary: {
    firstPrediction: { timestamp: string; value: number } | null;
    lastPrediction: { timestamp: string; value: number } | null;
    minPredicted: number | null;
    maxPredicted: number | null;
    avgPredicted: number | null;
    trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
  };
}

// =============================================================================
// Tool: get_incident
// =============================================================================

/**
 * Get incident details by ID
 *
 * @param orgId - Organization ID
 * @param incidentId - Incident ID
 * @returns Incident details with enriched context
 */
export async function getIncident(
  orgId: string,
  incidentId: string
): Promise<ToolResult<IncidentDetails>> {
  try {
    const db = getDb();
    const incidentRef = db.collection(COLLECTIONS.incidents(orgId)).doc(incidentId);
    const doc = await incidentRef.get();

    if (!doc.exists) {
      return {
        success: false,
        error: `Incident '${incidentId}' not found`,
      };
    }

    const incident = doc.data() as AlertIncident;

    // Calculate duration if resolved
    let durationMinutes: number | null = null;
    if (incident.resolvedAt) {
      const startTime = incident.startedAt instanceof Date
        ? incident.startedAt
        : (incident.startedAt as FirebaseFirestore.Timestamp).toDate();
      const endTime = incident.resolvedAt instanceof Date
        ? incident.resolvedAt
        : (incident.resolvedAt as FirebaseFirestore.Timestamp).toDate();
      durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    }

    return {
      success: true,
      data: {
        incident,
        alertCount: incident.alertEventIds?.length || 0,
        metricCount: incident.relatedMetrics?.length || 0,
        durationMinutes,
        isResolved: incident.status === 'resolved',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get incident: ${(error as Error).message}`,
    };
  }
}

// =============================================================================
// Tool: list_incident_alerts
// =============================================================================

/**
 * List alerts associated with an incident
 *
 * @param orgId - Organization ID
 * @param incidentId - Incident ID
 * @param limit - Maximum number of alerts to return (default: 20)
 * @returns List of alert summaries
 */
export async function listIncidentAlerts(
  orgId: string,
  incidentId: string,
  limit: number = 20
): Promise<ToolResult<AlertSummary[]>> {
  try {
    const db = getDb();

    // First get the incident to find associated alert IDs
    const incidentResult = await getIncident(orgId, incidentId);
    if (!incidentResult.success || !incidentResult.data) {
      return {
        success: false,
        error: incidentResult.error || 'Incident not found',
      };
    }

    const { incident } = incidentResult.data;
    const alertIds = incident.alertEventIds?.slice(0, limit) || [];

    if (alertIds.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Fetch alert events
    const alerts: AlertSummary[] = [];
    const alertEventsRef = db.collection(COLLECTIONS.alertEvents(orgId));

    // Fetch in batches (Firestore limits 'in' queries to 10)
    const batchSize = 10;
    for (let i = 0; i < alertIds.length; i += batchSize) {
      const batchIds = alertIds.slice(i, i + batchSize);
      const snapshot = await alertEventsRef.where('id', 'in', batchIds).get();

      snapshot.forEach(doc => {
        const alert = doc.data() as AlertEvent;
        alerts.push({
          id: alert.id,
          metricName: alert.metricName,
          triggeredAt: alert.triggeredAt instanceof Date
            ? alert.triggeredAt
            : (alert.triggeredAt as FirebaseFirestore.Timestamp).toDate(),
          triggerValue: alert.triggerValue,
          threshold: alert.threshold,
          direction: alert.direction,
          condition: alert.condition,
          deliveryStatus: alert.deliveryStatus,
        });
      });
    }

    // Sort by triggered time descending
    alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());

    return {
      success: true,
      data: alerts,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list incident alerts: ${(error as Error).message}`,
    };
  }
}

// =============================================================================
// Tool: list_related_metrics
// =============================================================================

/**
 * Get metrics related to an incident
 *
 * @param orgId - Organization ID
 * @param incidentId - Incident ID
 * @returns List of metrics with recent statistics
 */
export async function listRelatedMetrics(
  orgId: string,
  incidentId: string
): Promise<ToolResult<MetricWithStats[]>> {
  try {
    const db = getDb();

    // First get the incident to find related metric names
    const incidentResult = await getIncident(orgId, incidentId);
    if (!incidentResult.success || !incidentResult.data) {
      return {
        success: false,
        error: incidentResult.error || 'Incident not found',
      };
    }

    const { incident } = incidentResult.data;
    const metricNames = incident.relatedMetrics || [];

    if (metricNames.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Fetch metrics by name
    const metricsRef = db.collection(COLLECTIONS.metrics(orgId));
    const metricsWithStats: MetricWithStats[] = [];

    // Firestore limits 'in' queries to 10
    const batchSize = 10;
    for (let i = 0; i < metricNames.length; i += batchSize) {
      const batchNames = metricNames.slice(i, i + batchSize);
      const snapshot = await metricsRef.where('name', 'in', batchNames).get();

      for (const doc of snapshot.docs) {
        const metric = doc.data() as Metric;

        // Get recent time series stats
        const stats = await getMetricStats(orgId, metric.id, '24h');

        metricsWithStats.push({
          metric,
          recentPointCount: stats.pointCount,
          latestValue: stats.latestValue,
          latestTimestamp: stats.latestTimestamp,
          minValue: stats.minValue,
          maxValue: stats.maxValue,
          avgValue: stats.avgValue,
        });
      }
    }

    return {
      success: true,
      data: metricsWithStats,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list related metrics: ${(error as Error).message}`,
    };
  }
}

/**
 * Get basic statistics for a metric over a time window
 */
async function getMetricStats(
  orgId: string,
  metricId: string,
  window: TimeWindow
): Promise<{
  pointCount: number;
  latestValue?: number;
  latestTimestamp?: Date;
  minValue?: number;
  maxValue?: number;
  avgValue?: number;
}> {
  try {
    const db = getDb();
    const windowMs = parseTimeWindow(window);
    const cutoffTime = new Date(Date.now() - windowMs);

    const timeseriesRef = db.collection(COLLECTIONS.timeseries(orgId));
    const snapshot = await timeseriesRef
      .where('metricId', '==', metricId)
      .where('endTime', '>=', cutoffTime)
      .orderBy('endTime', 'desc')
      .limit(10) // Limit documents to check
      .get();

    if (snapshot.empty) {
      return { pointCount: 0 };
    }

    // Aggregate points from documents
    const allPoints: TimeSeriesPoint[] = [];

    snapshot.forEach(doc => {
      const tsDoc = doc.data() as TimeSeriesDocument;
      for (const point of tsDoc.points) {
        const pointTime = point.timestamp instanceof Date
          ? point.timestamp
          : (point.timestamp as unknown as FirebaseFirestore.Timestamp).toDate();
        if (pointTime >= cutoffTime) {
          allPoints.push({
            timestamp: pointTime,
            value: point.value,
          });
        }
      }
    });

    if (allPoints.length === 0) {
      return { pointCount: 0 };
    }

    // Sort by timestamp
    allPoints.sort((a, b) => {
      const aTime = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp as unknown as string);
      const bTime = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp as unknown as string);
      return bTime.getTime() - aTime.getTime();
    });

    // Calculate statistics
    const values = allPoints.map(p => p.value);
    const latest = allPoints[0];

    return {
      pointCount: allPoints.length,
      latestValue: latest.value,
      latestTimestamp: latest.timestamp instanceof Date ? latest.timestamp : new Date(latest.timestamp as unknown as string),
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
      avgValue: values.reduce((a, b) => a + b, 0) / values.length,
    };
  } catch {
    return { pointCount: 0 };
  }
}

// =============================================================================
// Tool: get_metric_timeseries
// =============================================================================

/**
 * Get recent time series data for a metric
 *
 * @param orgId - Organization ID
 * @param metricId - Metric ID (or metric name)
 * @param window - Time window (1h, 6h, 24h, 7d, 30d)
 * @returns Array of data points
 */
export async function getMetricTimeseries(
  orgId: string,
  metricId: string,
  window: TimeWindow = '24h'
): Promise<ToolResult<DataPoint[]>> {
  try {
    const db = getDb();
    const windowMs = parseTimeWindow(window);
    const cutoffTime = new Date(Date.now() - windowMs);

    // Try to find metric by ID or name
    let resolvedMetricId = metricId;

    // Check if it's a name rather than ID
    if (!metricId.includes('_')) {
      const metricsRef = db.collection(COLLECTIONS.metrics(orgId));
      const snapshot = await metricsRef.where('name', '==', metricId).limit(1).get();
      if (!snapshot.empty) {
        resolvedMetricId = snapshot.docs[0].id;
      }
    }

    // Fetch time series documents
    const timeseriesRef = db.collection(COLLECTIONS.timeseries(orgId));
    const snapshot = await timeseriesRef
      .where('metricId', '==', resolvedMetricId)
      .where('endTime', '>=', cutoffTime)
      .orderBy('endTime', 'desc')
      .limit(50)
      .get();

    // Aggregate points from documents
    const allPoints: DataPoint[] = [];

    snapshot.forEach(doc => {
      const tsDoc = doc.data() as TimeSeriesDocument;
      for (const point of tsDoc.points) {
        const pointTime = point.timestamp instanceof Date
          ? point.timestamp
          : (point.timestamp as unknown as FirebaseFirestore.Timestamp).toDate();
        if (pointTime >= cutoffTime) {
          allPoints.push({
            timestamp: pointTime.toISOString(),
            value: point.value,
          });
        }
      }
    });

    // Sort by timestamp ascending (oldest first)
    allPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      success: true,
      data: allPoints,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get time series: ${(error as Error).message}`,
    };
  }
}

// =============================================================================
// Tool: get_forecast
// =============================================================================

/**
 * Get latest forecast for a metric
 *
 * @param orgId - Organization ID
 * @param metricId - Metric ID or name
 * @returns Forecast summary with predictions and analysis
 */
export async function getForecast(
  orgId: string,
  metricId: string
): Promise<ToolResult<ForecastSummary>> {
  try {
    const db = getDb();

    // Try to resolve metric name to ID
    let metricName = metricId;
    if (!metricId.includes('_')) {
      metricName = metricId;
    } else {
      // Look up the metric name
      const metricDoc = await db.collection(COLLECTIONS.metrics(orgId)).doc(metricId).get();
      if (metricDoc.exists) {
        metricName = (metricDoc.data() as Metric).name;
      }
    }

    // Get latest forecast for this metric
    const forecastsRef = db.collection(COLLECTIONS.forecasts(orgId));
    const snapshot = await forecastsRef
      .where('metricName', '==', metricName)
      .where('status', '==', 'completed')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        success: false,
        error: `No forecast found for metric '${metricName}'`,
      };
    }

    const forecast = snapshot.docs[0].data() as Forecast;

    // Parse predictions
    const predictions = forecast.predictions.map(p => ({
      timestamp: p.timestamp instanceof Date
        ? p.timestamp.toISOString()
        : (p.timestamp as unknown as FirebaseFirestore.Timestamp).toDate().toISOString(),
      predictedValue: p.predictedValue,
      confidenceLower: p.confidenceLower,
      confidenceUpper: p.confidenceUpper,
    }));

    // Calculate summary statistics
    const values = predictions.map(p => p.predictedValue);
    const firstPrediction = predictions.length > 0
      ? { timestamp: predictions[0].timestamp, value: predictions[0].predictedValue }
      : null;
    const lastPrediction = predictions.length > 0
      ? { timestamp: predictions[predictions.length - 1].timestamp, value: predictions[predictions.length - 1].predictedValue }
      : null;

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' | 'unknown' = 'unknown';
    if (firstPrediction && lastPrediction) {
      const diff = lastPrediction.value - firstPrediction.value;
      const threshold = Math.abs(firstPrediction.value) * 0.05; // 5% threshold
      if (diff > threshold) {
        trend = 'increasing';
      } else if (diff < -threshold) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }
    }

    const summary: ForecastSummary = {
      id: forecast.id,
      metricName: forecast.metricName,
      horizonDays: forecast.horizonDays,
      backend: forecast.backend,
      status: forecast.status,
      createdAt: forecast.createdAt instanceof Date
        ? forecast.createdAt
        : (forecast.createdAt as unknown as FirebaseFirestore.Timestamp).toDate(),
      predictions,
      summary: {
        firstPrediction,
        lastPrediction,
        minPredicted: values.length > 0 ? Math.min(...values) : null,
        maxPredicted: values.length > 0 ? Math.max(...values) : null,
        avgPredicted: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null,
        trend,
      },
    };

    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get forecast: ${(error as Error).message}`,
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse time window string to milliseconds
 */
function parseTimeWindow(window: TimeWindow): number {
  const units: Record<string, number> = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const match = window.match(/^(\d+)([hd])$/);
  if (!match) {
    return 24 * 60 * 60 * 1000; // Default to 24h
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  return value * units[unit];
}

// =============================================================================
// Tool Registry
// =============================================================================

/**
 * All available tools for agents
 */
export const AGENT_TOOLS = {
  get_incident: {
    name: 'get_incident',
    description: 'Get details about an incident including status, duration, and related alerts/metrics',
    parameters: {
      orgId: { type: 'string', description: 'Organization ID' },
      incidentId: { type: 'string', description: 'Incident ID' },
    },
    execute: getIncident,
  },
  list_incident_alerts: {
    name: 'list_incident_alerts',
    description: 'List all alert events associated with an incident',
    parameters: {
      orgId: { type: 'string', description: 'Organization ID' },
      incidentId: { type: 'string', description: 'Incident ID' },
      limit: { type: 'number', description: 'Maximum alerts to return', default: 20 },
    },
    execute: listIncidentAlerts,
  },
  list_related_metrics: {
    name: 'list_related_metrics',
    description: 'Get metrics related to an incident with recent statistics',
    parameters: {
      orgId: { type: 'string', description: 'Organization ID' },
      incidentId: { type: 'string', description: 'Incident ID' },
    },
    execute: listRelatedMetrics,
  },
  get_metric_timeseries: {
    name: 'get_metric_timeseries',
    description: 'Get recent time series data points for a metric',
    parameters: {
      orgId: { type: 'string', description: 'Organization ID' },
      metricId: { type: 'string', description: 'Metric ID or name' },
      window: { type: 'string', description: 'Time window (1h, 6h, 24h, 7d, 30d)', default: '24h' },
    },
    execute: getMetricTimeseries,
  },
  get_forecast: {
    name: 'get_forecast',
    description: 'Get the latest forecast for a metric with predictions and trend analysis',
    parameters: {
      orgId: { type: 'string', description: 'Organization ID' },
      metricId: { type: 'string', description: 'Metric ID or name' },
    },
    execute: getForecast,
  },
} as const;

export type ToolName = keyof typeof AGENT_TOOLS;
