/**
 * Incident Service - Alert Correlation & Grouping
 *
 * Phase 16: Smarter Alerts - Correlation & Grouping
 *
 * Groups related alerts into incidents for better context and reduced noise.
 * Provides correlation analysis and root cause hints.
 */

import { getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type AlertIncident,
  type AlertEvent,
  type IncidentStatus,
  type Metric,
} from '../firestore/schema.js';

// Re-export for convenience
export type { AlertIncident };

// =============================================================================
// Types
// =============================================================================

export interface IncidentOptions {
  /** Time window for grouping alerts (minutes) */
  timeWindowMinutes?: number;
}

export interface CorrelationAnalysis {
  /** Correlated alerts grouped by time proximity */
  groups: Array<{
    /** Alert events in this group */
    alerts: AlertEvent[];
    /** Time span of this group */
    timeSpan: {
      start: Date;
      end: Date;
    };
    /** Related metrics in this group */
    relatedMetrics: string[];
    /** Shared tags across metrics */
    sharedTags?: string[];
  }>;
  /** Total number of correlated groups */
  groupCount: number;
  /** Total alerts analyzed */
  totalAlerts: number;
}

export interface ListIncidentsOptions {
  status?: IncidentStatus;
  limit?: number;
  metricName?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIME_WINDOW_MINUTES = 10;
const DEFAULT_LIST_LIMIT = 50;

// =============================================================================
// Incident Creation & Updates
// =============================================================================

/**
 * Find or create an incident for an alert event
 *
 * Logic:
 * 1. Look for open incidents in the same org within the time window
 * 2. Check if any have overlapping metrics
 * 3. If found, add alert to existing incident
 * 4. Otherwise create new incident
 */
export async function findOrCreateIncident(
  alertEvent: AlertEvent,
  options: IncidentOptions = {}
): Promise<AlertIncident> {
  const { timeWindowMinutes = DEFAULT_TIME_WINDOW_MINUTES } = options;
  const db = getDb();

  // Look for open incidents in the same org
  const windowStart = new Date(
    new Date(alertEvent.triggeredAt).getTime() - timeWindowMinutes * 60 * 1000
  );

  const incidentsSnapshot = await db
    .collection(COLLECTIONS.incidents(alertEvent.orgId))
    .where('status', '==', 'open')
    .where('startedAt', '>=', windowStart)
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openIncidents: AlertIncident[] = incidentsSnapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Check if any existing incident has related metrics
  for (const incident of openIncidents) {
    if (incident.relatedMetrics.includes(alertEvent.metricName)) {
      // Add alert to existing incident
      return await addAlertToIncident(incident.id, alertEvent, timeWindowMinutes);
    }
  }

  // No related incident found - create new one
  return await createNewIncident(alertEvent, timeWindowMinutes);
}

/**
 * Create a new incident from an alert event
 */
async function createNewIncident(
  alertEvent: AlertEvent,
  timeWindowMinutes: number
): Promise<AlertIncident> {
  const db = getDb();
  const incidentId = generateId('inc');
  const now = new Date();

  const incident: AlertIncident = {
    id: incidentId,
    orgId: alertEvent.orgId,
    title: `Alert: ${alertEvent.metricName}`,
    summary: `1 alert triggered for ${alertEvent.metricName}`,
    status: 'open',
    startedAt: new Date(alertEvent.triggeredAt),
    alertEventIds: [alertEvent.id],
    relatedMetrics: [alertEvent.metricName],
    correlationMetadata: {
      timeWindowMinutes,
    },
    createdAt: now,
    updatedAt: now,
  };

  await db
    .collection(COLLECTIONS.incidents(alertEvent.orgId))
    .doc(incidentId)
    .set(incident);

  console.log(`[IncidentService] Created new incident ${incidentId} for alert ${alertEvent.id}`);

  return incident;
}

/**
 * Add an alert to an existing incident
 */
async function addAlertToIncident(
  incidentId: string,
  alertEvent: AlertEvent,
  timeWindowMinutes: number
): Promise<AlertIncident> {
  const db = getDb();
  const incidentRef = db
    .collection(COLLECTIONS.incidents(alertEvent.orgId))
    .doc(incidentId);

  const incidentDoc = await incidentRef.get();
  if (!incidentDoc.exists) {
    // If incident doesn't exist, create new one
    return await createNewIncident(alertEvent, timeWindowMinutes);
  }

  const incident = incidentDoc.data() as AlertIncident;

  // Update incident with new alert
  const updatedAlertEventIds = [...incident.alertEventIds, alertEvent.id];
  const updatedRelatedMetrics = Array.from(
    new Set([...incident.relatedMetrics, alertEvent.metricName])
  );

  await incidentRef.update({
    alertEventIds: updatedAlertEventIds,
    relatedMetrics: updatedRelatedMetrics,
    updatedAt: new Date(),
  });

  // Update summary
  await updateIncidentSummary(incidentId, alertEvent.orgId);

  console.log(
    `[IncidentService] Added alert ${alertEvent.id} to incident ${incidentId}`
  );

  // Fetch and return updated incident
  const updatedDoc = await incidentRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() } as AlertIncident;
}

/**
 * Update incident summary based on grouped alerts
 */
export async function updateIncidentSummary(
  incidentId: string,
  orgId: string
): Promise<void> {
  const db = getDb();
  const incidentRef = db.collection(COLLECTIONS.incidents(orgId)).doc(incidentId);

  const incidentDoc = await incidentRef.get();
  if (!incidentDoc.exists) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  const incident = incidentDoc.data() as AlertIncident;

  // Generate summary
  const alertCount = incident.alertEventIds.length;
  const metricCount = incident.relatedMetrics.length;
  const metrics = incident.relatedMetrics.join(', ');

  const summary =
    alertCount === 1
      ? `1 alert for ${metrics}`
      : `${alertCount} alerts across ${metricCount} metric${metricCount > 1 ? 's' : ''}: ${metrics}`;

  await incidentRef.update({
    summary,
    updatedAt: new Date(),
  });

  console.log(`[IncidentService] Updated summary for incident ${incidentId}`);
}

// =============================================================================
// Incident Status Management
// =============================================================================

/**
 * Resolve an incident
 */
export async function resolveIncident(
  incidentId: string,
  orgId: string
): Promise<AlertIncident> {
  const db = getDb();
  const incidentRef = db.collection(COLLECTIONS.incidents(orgId)).doc(incidentId);

  const incidentDoc = await incidentRef.get();
  if (!incidentDoc.exists) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  const now = new Date();
  await incidentRef.update({
    status: 'resolved',
    resolvedAt: now,
    updatedAt: now,
  });

  console.log(`[IncidentService] Resolved incident ${incidentId}`);

  const updatedDoc = await incidentRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() } as AlertIncident;
}

/**
 * Acknowledge an incident
 */
export async function acknowledgeIncident(
  incidentId: string,
  orgId: string,
  userId?: string
): Promise<AlertIncident> {
  const db = getDb();
  const incidentRef = db.collection(COLLECTIONS.incidents(orgId)).doc(incidentId);

  const incidentDoc = await incidentRef.get();
  if (!incidentDoc.exists) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  await incidentRef.update({
    status: 'acknowledged',
    updatedAt: new Date(),
  });

  console.log(
    `[IncidentService] Acknowledged incident ${incidentId}${userId ? ` by user ${userId}` : ''}`
  );

  const updatedDoc = await incidentRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() } as AlertIncident;
}

// =============================================================================
// Incident Retrieval
// =============================================================================

/**
 * Get a single incident
 */
export async function getIncident(
  incidentId: string,
  orgId: string
): Promise<AlertIncident | null> {
  const db = getDb();
  const incidentDoc = await db
    .collection(COLLECTIONS.incidents(orgId))
    .doc(incidentId)
    .get();

  if (!incidentDoc.exists) {
    return null;
  }

  return { id: incidentDoc.id, ...incidentDoc.data() } as AlertIncident;
}

/**
 * List incidents for an organization
 */
export async function listIncidents(
  orgId: string,
  options: ListIncidentsOptions = {}
): Promise<AlertIncident[]> {
  const { status, limit = DEFAULT_LIST_LIMIT, metricName } = options;
  const db = getDb();

  let query = db
    .collection(COLLECTIONS.incidents(orgId))
    .orderBy('startedAt', 'desc')
    .limit(limit);

  // Filter by status if provided
  if (status) {
    query = query.where('status', '==', status) as any;
  }

  const snapshot = await query.get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let incidents: AlertIncident[] = snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Filter by metric name in memory (Firestore array-contains limitation)
  if (metricName) {
    incidents = incidents.filter((inc) => inc.relatedMetrics.includes(metricName));
  }

  return incidents;
}

// =============================================================================
// Correlation Analysis
// =============================================================================

/**
 * Correlate alerts by time proximity and shared attributes
 *
 * Groups alerts that occurred within the same time window
 * and identifies patterns like shared tags or related metrics
 */
export async function correlateAlerts(
  _orgId: string,
  alertEvents: AlertEvent[],
  options: IncidentOptions = {}
): Promise<CorrelationAnalysis> {
  const { timeWindowMinutes = DEFAULT_TIME_WINDOW_MINUTES } = options;

  if (alertEvents.length === 0) {
    return {
      groups: [],
      groupCount: 0,
      totalAlerts: 0,
    };
  }

  // Sort alerts by triggered time
  const sortedAlerts = [...alertEvents].sort(
    (a, b) =>
      new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime()
  );

  const groups: CorrelationAnalysis['groups'] = [];
  let currentGroup: AlertEvent[] = [sortedAlerts[0]];
  let groupStart = new Date(sortedAlerts[0].triggeredAt);

  // Group alerts by time window
  for (let i = 1; i < sortedAlerts.length; i++) {
    const alert = sortedAlerts[i];
    const alertTime = new Date(alert.triggeredAt);
    const timeDiff = (alertTime.getTime() - groupStart.getTime()) / (1000 * 60);

    if (timeDiff <= timeWindowMinutes) {
      // Add to current group
      currentGroup.push(alert);
    } else {
      // Finalize current group and start new one
      if (currentGroup.length > 0) {
        groups.push(createGroup(currentGroup, groupStart));
      }
      currentGroup = [alert];
      groupStart = alertTime;
    }
  }

  // Add final group
  if (currentGroup.length > 0) {
    groups.push(createGroup(currentGroup, groupStart));
  }

  return {
    groups,
    groupCount: groups.length,
    totalAlerts: alertEvents.length,
  };
}

/**
 * Create a correlation group from alerts
 */
function createGroup(
  alerts: AlertEvent[],
  groupStart: Date
): CorrelationAnalysis['groups'][0] {
  const relatedMetrics = Array.from(
    new Set(alerts.map((a) => a.metricName))
  );

  const groupEnd =
    alerts.length > 0
      ? new Date(alerts[alerts.length - 1].triggeredAt)
      : groupStart;

  return {
    alerts,
    timeSpan: {
      start: groupStart,
      end: groupEnd,
    },
    relatedMetrics,
  };
}

/**
 * Get related metrics for an alert event
 *
 * Finds metrics that may be correlated with the given alert
 * based on shared tags or naming patterns
 */
export async function getRelatedMetrics(
  alertEvent: AlertEvent
): Promise<string[]> {
  const db = getDb();
  const { orgId } = alertEvent;

  // Get the metric for this alert
  const metricsSnapshot = await db
    .collection(COLLECTIONS.metrics(orgId))
    .where('name', '==', alertEvent.metricName)
    .limit(1)
    .get();

  if (metricsSnapshot.empty) {
    return [];
  }

  const metric = metricsSnapshot.docs[0].data() as Metric;
  const relatedMetrics: string[] = [];

  // Find metrics with shared tags
  if (metric.tags) {
    const tagKeys = Object.keys(metric.tags);

    for (const tagKey of tagKeys) {
      const tagValue = metric.tags[tagKey];

      // Find other metrics with same tag value
      const relatedSnapshot = await db
        .collection(COLLECTIONS.metrics(orgId))
        .where(`tags.${tagKey}`, '==', tagValue)
        .limit(10)
        .get();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      relatedSnapshot.docs.forEach((doc: any) => {
        const relatedMetric = doc.data() as Metric;
        if (
          relatedMetric.name !== alertEvent.metricName &&
          !relatedMetrics.includes(relatedMetric.name)
        ) {
          relatedMetrics.push(relatedMetric.name);
        }
      });
    }
  }

  // Find metrics with similar names (same prefix)
  const namePrefix = alertEvent.metricName.split('_')[0];
  if (namePrefix) {
    const prefixSnapshot = await db
      .collection(COLLECTIONS.metrics(orgId))
      .where('name', '>=', namePrefix)
      .where('name', '<', namePrefix + '\uf8ff')
      .limit(10)
      .get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prefixSnapshot.docs.forEach((doc: any) => {
      const relatedMetric = doc.data() as Metric;
      if (
        relatedMetric.name !== alertEvent.metricName &&
        !relatedMetrics.includes(relatedMetric.name)
      ) {
        relatedMetrics.push(relatedMetric.name);
      }
    });
  }

  return relatedMetrics;
}
