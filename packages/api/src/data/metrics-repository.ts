/**
 * Firestore Metrics Repository
 *
 * Phase E2E: Single-Metric Forecast Demo
 * Beads Task: intentvision-310
 *
 * Repository pattern for metric data storage in Firestore.
 * Handles metric definitions, time series points, and forecast results.
 *
 * Collection structure:
 * - orgs/{orgId}/demoMetrics/{metricId}           - metric definition
 * - orgs/{orgId}/demoMetrics/{metricId}/points    - historical points (sub-collection)
 * - orgs/{orgId}/demoMetrics/{metricId}/forecasts - forecast results (sub-collection)
 */

import { getDb, generateId, toTimestamp } from '../firestore/client.js';

// =============================================================================
// Types
// =============================================================================

export interface MetricPoint {
  timestamp: string; // ISO-8601
  value: number;
}

export interface MetricDefinition {
  orgId: string;
  metricId: string;
  name: string;
  unit?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ForecastResult {
  id: string;
  orgId: string;
  metricId: string;
  horizonDays: number;
  generatedAt: string; // ISO-8601
  points: MetricPoint[];
  backend: 'stub' | 'timegpt' | 'stat';
  inputPointsCount: number;
  modelInfo?: {
    name: string;
    version?: string;
  };
}

export interface MetricsRepository {
  upsertMetric(def: MetricDefinition): Promise<void>;
  getMetric(orgId: string, metricId: string): Promise<MetricDefinition | null>;
  appendPoints(orgId: string, metricId: string, points: MetricPoint[]): Promise<number>;
  getRecentPoints(orgId: string, metricId: string, limit: number): Promise<MetricPoint[]>;
  saveForecast(result: ForecastResult): Promise<void>;
  getLatestForecast(orgId: string, metricId: string): Promise<ForecastResult | null>;
}

// =============================================================================
// Collection Paths
// =============================================================================

const DEMO_COLLECTIONS = {
  demoMetrics: (orgId: string) => `orgs/${orgId}/demoMetrics`,
  points: (orgId: string, metricId: string) => `orgs/${orgId}/demoMetrics/${metricId}/points`,
  forecasts: (orgId: string, metricId: string) => `orgs/${orgId}/demoMetrics/${metricId}/forecasts`,
} as const;

// =============================================================================
// Firestore Implementation
// =============================================================================

class FirestoreMetricsRepository implements MetricsRepository {
  /**
   * Create or update a metric definition
   */
  async upsertMetric(def: MetricDefinition): Promise<void> {
    const db = getDb();
    const collectionPath = DEMO_COLLECTIONS.demoMetrics(def.orgId);
    const docRef = db.collection(collectionPath).doc(def.metricId);

    const existingDoc = await docRef.get();
    const now = new Date();

    if (existingDoc.exists) {
      // Update existing
      await docRef.update({
        name: def.name,
        unit: def.unit,
        description: def.description,
        updatedAt: now,
      });
    } else {
      // Create new
      await docRef.set({
        ...def,
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log(`[MetricsRepo] Upserted metric: ${def.orgId}/${def.metricId}`);
  }

  /**
   * Get a metric definition by ID
   */
  async getMetric(orgId: string, metricId: string): Promise<MetricDefinition | null> {
    const db = getDb();
    const collectionPath = DEMO_COLLECTIONS.demoMetrics(orgId);
    const doc = await db.collection(collectionPath).doc(metricId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      orgId,
      metricId,
      name: data?.name || metricId,
      unit: data?.unit,
      description: data?.description,
      createdAt: data?.createdAt?.toDate?.() || new Date(),
      updatedAt: data?.updatedAt?.toDate?.() || new Date(),
    };
  }

  /**
   * Append metric data points
   * Returns the number of points ingested
   */
  async appendPoints(orgId: string, metricId: string, points: MetricPoint[]): Promise<number> {
    if (points.length === 0) {
      return 0;
    }

    const db = getDb();
    const collectionPath = DEMO_COLLECTIONS.points(orgId, metricId);
    const collection = db.collection(collectionPath);

    // Batch write for efficiency
    const batch = db.batch();
    let count = 0;

    for (const point of points) {
      // Use timestamp as document ID for idempotency
      const docId = this.timestampToDocId(point.timestamp);
      const docRef = collection.doc(docId);

      batch.set(docRef, {
        timestamp: toTimestamp(point.timestamp),
        value: point.value,
        ingestedAt: new Date(),
      });
      count++;
    }

    await batch.commit();
    console.log(`[MetricsRepo] Appended ${count} points to ${orgId}/${metricId}`);

    return count;
  }

  /**
   * Get recent metric points, sorted by timestamp descending
   */
  async getRecentPoints(orgId: string, metricId: string, limit: number): Promise<MetricPoint[]> {
    const db = getDb();
    const collectionPath = DEMO_COLLECTIONS.points(orgId, metricId);

    const snapshot = await db
      .collection(collectionPath)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const points: MetricPoint[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const ts = data.timestamp?.toDate?.() || new Date(data.timestamp);
      points.push({
        timestamp: ts.toISOString(),
        value: data.value,
      });
    });

    // Reverse to get chronological order (oldest first)
    return points.reverse();
  }

  /**
   * Save a forecast result
   */
  async saveForecast(result: ForecastResult): Promise<void> {
    const db = getDb();
    const collectionPath = DEMO_COLLECTIONS.forecasts(result.orgId, result.metricId);

    const forecastId = result.id || generateId('fc');
    const docRef = db.collection(collectionPath).doc(forecastId);

    await docRef.set({
      id: forecastId,
      orgId: result.orgId,
      metricId: result.metricId,
      horizonDays: result.horizonDays,
      generatedAt: toTimestamp(result.generatedAt),
      points: result.points,
      backend: result.backend,
      inputPointsCount: result.inputPointsCount,
      modelInfo: result.modelInfo,
      createdAt: new Date(),
    });

    console.log(`[MetricsRepo] Saved forecast: ${result.orgId}/${result.metricId}/${forecastId}`);
  }

  /**
   * Get the most recent forecast for a metric
   */
  async getLatestForecast(orgId: string, metricId: string): Promise<ForecastResult | null> {
    const db = getDb();
    const collectionPath = DEMO_COLLECTIONS.forecasts(orgId, metricId);

    const snapshot = await db
      .collection(collectionPath)
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = snapshot.docs[0] as any;
    const data = doc.data();

    return {
      id: data.id || doc.id,
      orgId: data.orgId,
      metricId: data.metricId,
      horizonDays: data.horizonDays,
      generatedAt: data.generatedAt?.toDate?.()?.toISOString() || data.generatedAt,
      points: data.points || [],
      backend: data.backend || 'stub',
      inputPointsCount: data.inputPointsCount || 0,
      modelInfo: data.modelInfo,
    };
  }

  /**
   * Convert timestamp to document ID (for idempotency)
   */
  private timestampToDocId(timestamp: string): string {
    // Use ISO timestamp with special chars replaced for valid Firestore doc ID
    return timestamp.replace(/[:.]/g, '-');
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let _repository: MetricsRepository | null = null;

/**
 * Get the metrics repository singleton
 */
export function getMetricsRepository(): MetricsRepository {
  if (!_repository) {
    _repository = new FirestoreMetricsRepository();
  }
  return _repository;
}

/**
 * Reset repository (for testing)
 */
export function resetMetricsRepository(): void {
  _repository = null;
}
