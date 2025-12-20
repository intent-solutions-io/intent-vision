/**
 * Backend Usage Service
 *
 * Phase 18: Plan-Aware Cost Guardrails & Backend Selection
 * Beads Task: intentvision-[TBD]
 *
 * Tracks daily usage of premium forecast backends (Nixtla, LLM).
 * Enforces plan-based daily limits and provides usage reporting.
 */

import { getDb } from '../firestore/client.js';
import { COLLECTIONS, type BackendUsage } from '../firestore/schema.js';
import type { ForecastBackend } from '../forecast/backend-policy.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Format a date object to YYYY-MM-DD
 */
function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// =============================================================================
// Usage Tracking
// =============================================================================

/**
 * Increment backend usage counter for today
 * Creates usage record if it doesn't exist
 */
export async function incrementBackendUsage(
  orgId: string,
  backend: ForecastBackend
): Promise<void> {
  const db = getDb();
  const today = getTodayDateString();
  const docId = today; // Use date as document ID for easy lookup

  const usageRef = db
    .collection(COLLECTIONS.backendUsage(orgId))
    .doc(docId);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(usageRef);

      if (!doc.exists) {
        // Create new usage record
        const newUsage: BackendUsage = {
          orgId,
          date: today,
          statistical: backend === 'statistical' ? 1 : 0,
          nixtla: backend === 'nixtla' ? 1 : 0,
          llm: backend === 'llm' ? 1 : 0,
          updatedAt: new Date(),
        };
        transaction.set(usageRef, newUsage);
      } else {
        // Increment existing counter
        const fieldName = backend as keyof Pick<BackendUsage, 'statistical' | 'nixtla' | 'llm'>;
        transaction.update(usageRef, {
          [fieldName]: (doc.data()?.[fieldName] || 0) + 1,
          updatedAt: new Date(),
        });
      }
    });

    console.log(`[BackendUsage] Incremented ${backend} usage for ${orgId} on ${today}`);
  } catch (error) {
    console.error(`[BackendUsage] Failed to increment usage:`, error);
    throw new Error(`Failed to track backend usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get backend usage for a specific date
 */
export async function getBackendUsage(
  orgId: string,
  date: string
): Promise<BackendUsage | null> {
  const db = getDb();
  const doc = await db
    .collection(COLLECTIONS.backendUsage(orgId))
    .doc(date)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as BackendUsage;
}

/**
 * Get today's backend usage
 */
export async function getTodaysUsage(orgId: string): Promise<BackendUsage> {
  const today = getTodayDateString();
  const usage = await getBackendUsage(orgId, today);

  // Return zero usage if no record exists yet
  if (!usage) {
    return {
      orgId,
      date: today,
      statistical: 0,
      nixtla: 0,
      llm: 0,
      updatedAt: new Date(),
    };
  }

  return usage;
}

/**
 * Get usage count for a specific backend today
 */
export async function getTodaysBackendCount(
  orgId: string,
  backend: ForecastBackend
): Promise<number> {
  const usage = await getTodaysUsage(orgId);

  switch (backend) {
    case 'statistical':
      return usage.statistical;
    case 'nixtla':
      return usage.nixtla;
    case 'llm':
      return usage.llm;
    default:
      return 0;
  }
}

/**
 * Get usage for a date range
 */
export async function getBackendUsageRange(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<BackendUsage[]> {
  const db = getDb();
  const startDateStr = formatDateString(startDate);
  const endDateStr = formatDateString(endDate);

  const snapshot = await db
    .collection(COLLECTIONS.backendUsage(orgId))
    .where('date', '>=', startDateStr)
    .where('date', '<=', endDateStr)
    .orderBy('date', 'desc')
    .get();

  return snapshot.docs.map((doc) => doc.data() as BackendUsage);
}

/**
 * Get usage summary for the last N days
 */
export async function getRecentUsageSummary(
  orgId: string,
  days: number = 7
): Promise<{
  totalStatistical: number;
  totalNixtla: number;
  totalLlm: number;
  dailyBreakdown: BackendUsage[];
}> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const usageRecords = await getBackendUsageRange(orgId, startDate, endDate);

  const totals = usageRecords.reduce(
    (acc, record) => ({
      totalStatistical: acc.totalStatistical + record.statistical,
      totalNixtla: acc.totalNixtla + record.nixtla,
      totalLlm: acc.totalLlm + record.llm,
    }),
    { totalStatistical: 0, totalNixtla: 0, totalLlm: 0 }
  );

  return {
    ...totals,
    dailyBreakdown: usageRecords,
  };
}

// =============================================================================
// Cleanup and Maintenance
// =============================================================================

/**
 * Delete old usage records beyond retention period
 * Recommended retention: 90 days for audit trail
 */
export async function cleanupOldUsageRecords(
  orgId: string,
  retentionDays: number = 90
): Promise<number> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffDateStr = formatDateString(cutoffDate);

  const snapshot = await db
    .collection(COLLECTIONS.backendUsage(orgId))
    .where('date', '<', cutoffDateStr)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  // Delete in batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`[BackendUsage] Deleted ${snapshot.size} old usage records for ${orgId}`);

  return snapshot.size;
}
