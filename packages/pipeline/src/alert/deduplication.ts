/**
 * Alert Deduplication and Suppression
 *
 * Task ID: intentvision-9ru.3
 *
 * Prevents alert storms through:
 * - Deduplication (same alert within window)
 * - Rate limiting (max alerts per period)
 * - Mute windows (scheduled quiet periods)
 * - Conditional suppression
 */

import { getClient } from '../../../../db/config.js';
import type { AlertTrigger, AlertSuppression } from '../../../contracts/src/index.js';

// =============================================================================
// Types
// =============================================================================

export interface DedupConfig {
  /** Default dedup window in ms */
  defaultWindowMs?: number;
  /** Max alerts per minute per org */
  rateLimitPerMinute?: number;
  /** Enable deduplication */
  enabled?: boolean;
}

export interface DedupResult {
  /** Whether alert should be sent */
  shouldSend: boolean;
  /** Reason for decision */
  reason: string;
  /** Previous alert if duplicate */
  previousAlert?: {
    alertId: string;
    triggeredAt: string;
  };
}

export interface SuppressionResult {
  suppressed: boolean;
  reason: string;
  suppressUntil?: string;
}

interface DedupRecord {
  dedup_key: string;
  alert_id: string;
  org_id: string;
  triggered_at: string;
  expires_at: string;
  count: number;
}

// =============================================================================
// Deduplication Manager
// =============================================================================

export class DeduplicationManager {
  private config: Required<DedupConfig>;
  private cache = new Map<string, DedupRecord>();
  private initialized = false;

  constructor(config: DedupConfig = {}) {
    this.config = {
      defaultWindowMs: config.defaultWindowMs ?? 5 * 60 * 1000, // 5 minutes
      rateLimitPerMinute: config.rateLimitPerMinute ?? 100,
      enabled: config.enabled ?? true,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const client = getClient();

    await client.execute(`
      CREATE TABLE IF NOT EXISTS alert_dedup (
        dedup_key TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        triggered_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        count INTEGER DEFAULT 1
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_alert_dedup_org
      ON alert_dedup (org_id)
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_alert_dedup_expires
      ON alert_dedup (expires_at)
    `);

    this.initialized = true;
  }

  /**
   * Check if alert should be deduplicated
   */
  async checkDedup(alert: AlertTrigger, windowMs?: number): Promise<DedupResult> {
    if (!this.config.enabled) {
      return { shouldSend: true, reason: 'Deduplication disabled' };
    }

    await this.initialize();

    const dedupKey = alert.routing.dedup_key || this.generateDedupKey(alert);
    const window = windowMs ?? this.config.defaultWindowMs;
    const now = Date.now();
    const expiresAt = new Date(now + window).toISOString();

    // Check in-memory cache first
    const cached = this.cache.get(dedupKey);
    if (cached) {
      const cachedExpires = new Date(cached.expires_at).getTime();
      if (cachedExpires > now) {
        // Update count
        cached.count++;
        return {
          shouldSend: false,
          reason: `Duplicate of alert ${cached.alert_id} (${cached.count} occurrences)`,
          previousAlert: {
            alertId: cached.alert_id,
            triggeredAt: cached.triggered_at,
          },
        };
      }
      // Expired, remove from cache
      this.cache.delete(dedupKey);
    }

    // Check database
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT * FROM alert_dedup
        WHERE dedup_key = ? AND expires_at > ?
      `,
      args: [dedupKey, new Date().toISOString()],
    });

    if (result.rows.length > 0) {
      const record = result.rows[0] as unknown as DedupRecord;

      // Update count
      await client.execute({
        sql: 'UPDATE alert_dedup SET count = count + 1 WHERE dedup_key = ?',
        args: [dedupKey],
      });

      // Cache for faster subsequent checks
      this.cache.set(dedupKey, {
        ...record,
        count: (record.count || 1) + 1,
      });

      return {
        shouldSend: false,
        reason: `Duplicate of alert ${record.alert_id} (${record.count + 1} occurrences)`,
        previousAlert: {
          alertId: record.alert_id,
          triggeredAt: record.triggered_at,
        },
      };
    }

    // No duplicate, record this alert
    const newRecord: DedupRecord = {
      dedup_key: dedupKey,
      alert_id: alert.alert_id,
      org_id: alert.org_id,
      triggered_at: alert.triggered_at,
      expires_at: expiresAt,
      count: 1,
    };

    await client.execute({
      sql: `
        INSERT OR REPLACE INTO alert_dedup (dedup_key, alert_id, org_id, triggered_at, expires_at, count)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        newRecord.dedup_key,
        newRecord.alert_id,
        newRecord.org_id,
        newRecord.triggered_at,
        newRecord.expires_at,
        newRecord.count,
      ],
    });

    this.cache.set(dedupKey, newRecord);

    return { shouldSend: true, reason: 'New alert' };
  }

  /**
   * Check rate limit for org
   */
  async checkRateLimit(orgId: string): Promise<DedupResult> {
    if (!this.config.enabled) {
      return { shouldSend: true, reason: 'Rate limiting disabled' };
    }

    await this.initialize();

    const client = getClient();
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const result = await client.execute({
      sql: `
        SELECT COUNT(*) as count FROM alert_dedup
        WHERE org_id = ? AND triggered_at > ?
      `,
      args: [orgId, oneMinuteAgo],
    });

    const count = Number(result.rows[0].count);

    if (count >= this.config.rateLimitPerMinute) {
      return {
        shouldSend: false,
        reason: `Rate limit exceeded: ${count}/${this.config.rateLimitPerMinute} alerts/minute`,
      };
    }

    return {
      shouldSend: true,
      reason: `Within rate limit: ${count}/${this.config.rateLimitPerMinute}`,
    };
  }

  /**
   * Clean up expired dedup records
   */
  async cleanup(): Promise<number> {
    await this.initialize();

    const client = getClient();
    const now = new Date().toISOString();

    const result = await client.execute({
      sql: 'DELETE FROM alert_dedup WHERE expires_at < ?',
      args: [now],
    });

    // Clean cache
    for (const [key, record] of this.cache) {
      if (new Date(record.expires_at).getTime() < Date.now()) {
        this.cache.delete(key);
      }
    }

    return result.rowsAffected;
  }

  private generateDedupKey(alert: AlertTrigger): string {
    // Generate dedup key from alert characteristics
    const parts = [
      alert.org_id,
      alert.metric_context.metric_key,
      alert.trigger_type,
      alert.severity,
    ];

    // Include dimensions
    const dims = Object.entries(alert.metric_context.dimensions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    if (dims) {
      parts.push(dims);
    }

    return parts.join(':');
  }
}

// =============================================================================
// Suppression Manager
// =============================================================================

export class SuppressionManager {
  /**
   * Check if alert should be suppressed based on rules
   */
  checkSuppression(alert: AlertTrigger, suppression?: AlertSuppression): SuppressionResult {
    if (!suppression) {
      return { suppressed: false, reason: 'No suppression rules' };
    }

    // Check mute windows
    if (suppression.mute_windows) {
      const muteResult = this.checkMuteWindows(suppression.mute_windows);
      if (muteResult.suppressed) {
        return muteResult;
      }
    }

    return { suppressed: false, reason: 'No active suppression' };
  }

  private checkMuteWindows(
    windows: Array<{ start: string; end: string; days?: number[] }>
  ): SuppressionResult {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const window of windows) {
      // Check if today is in the allowed days
      if (window.days && !window.days.includes(currentDay)) {
        continue;
      }

      // Check if current time is in the mute window
      if (this.isTimeInRange(currentTime, window.start, window.end)) {
        // Calculate when suppression ends
        const endParts = window.end.split(':');
        const endHour = parseInt(endParts[0], 10);
        const endMinute = parseInt(endParts[1], 10);

        const suppressUntil = new Date();
        suppressUntil.setHours(endHour, endMinute, 0, 0);

        if (suppressUntil <= now) {
          // Window end is tomorrow
          suppressUntil.setDate(suppressUntil.getDate() + 1);
        }

        return {
          suppressed: true,
          reason: `In mute window ${window.start}-${window.end}`,
          suppressUntil: suppressUntil.toISOString(),
        };
      }
    }

    return { suppressed: false, reason: 'Not in any mute window' };
  }

  private isTimeInRange(current: string, start: string, end: string): boolean {
    // Handle same-day and cross-midnight ranges
    if (start <= end) {
      // Same day range (e.g., 09:00-17:00)
      return current >= start && current <= end;
    } else {
      // Cross-midnight range (e.g., 22:00-06:00)
      return current >= start || current <= end;
    }
  }
}

// =============================================================================
// Combined Alert Filter
// =============================================================================

export class AlertFilter {
  private dedupManager: DeduplicationManager;
  private suppressionManager: SuppressionManager;

  constructor(dedupConfig: DedupConfig = {}) {
    this.dedupManager = new DeduplicationManager(dedupConfig);
    this.suppressionManager = new SuppressionManager();
  }

  /**
   * Check if alert should be processed
   */
  async shouldProcess(
    alert: AlertTrigger,
    suppression?: AlertSuppression
  ): Promise<{
    shouldProcess: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    // Check suppression first (doesn't require DB)
    const suppressionResult = this.suppressionManager.checkSuppression(alert, suppression);
    if (suppressionResult.suppressed) {
      return {
        shouldProcess: false,
        reasons: [suppressionResult.reason],
      };
    }
    reasons.push(suppressionResult.reason);

    // Check rate limit
    const rateLimitResult = await this.dedupManager.checkRateLimit(alert.org_id);
    if (!rateLimitResult.shouldSend) {
      return {
        shouldProcess: false,
        reasons: [rateLimitResult.reason],
      };
    }
    reasons.push(rateLimitResult.reason);

    // Check deduplication
    const dedupResult = await this.dedupManager.checkDedup(
      alert,
      suppression?.dedup_window_ms
    );
    if (!dedupResult.shouldSend) {
      return {
        shouldProcess: false,
        reasons: [dedupResult.reason],
      };
    }
    reasons.push(dedupResult.reason);

    return {
      shouldProcess: true,
      reasons,
    };
  }

  /**
   * Clean up expired records
   */
  async cleanup(): Promise<number> {
    return this.dedupManager.cleanup();
  }
}

// =============================================================================
// Factory
// =============================================================================

let _filter: AlertFilter | null = null;

export function getAlertFilter(config?: DedupConfig): AlertFilter {
  if (!_filter) {
    _filter = new AlertFilter(config);
  }
  return _filter;
}

export function resetAlertFilter(): void {
  _filter = null;
}
