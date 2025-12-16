/**
 * Alert Lifecycle Management
 *
 * Task ID: intentvision-9ru.4
 *
 * Manages alert states and transitions:
 * - Firing → Acknowledged → Resolved
 * - Escalation after timeout
 * - Auto-resolution on recovery
 * - History tracking
 */

import { getClient } from '../../../../db/config.js';
import type { AlertTrigger, AlertSeverity } from '../../../contracts/src/index.js';
import { logger } from '../observability/logger.js';

// =============================================================================
// Types
// =============================================================================

export type AlertStatus = 'firing' | 'acknowledged' | 'resolved' | 'escalated';

export interface AlertState {
  alertId: string;
  ruleId: string;
  orgId: string;
  status: AlertStatus;
  severity: AlertSeverity;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  escalatedAt?: string;
  escalationLevel: number;
  notificationCount: number;
  lastNotifiedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface LifecycleConfig {
  /** Auto-escalate after this duration (ms) */
  escalationTimeoutMs?: number;
  /** Max escalation level */
  maxEscalationLevel?: number;
  /** Auto-resolve after metric returns to normal (ms) */
  autoResolveDelayMs?: number;
  /** Reminder interval for unacknowledged alerts (ms) */
  reminderIntervalMs?: number;
}

export interface StateTransition {
  alertId: string;
  fromStatus: AlertStatus;
  toStatus: AlertStatus;
  timestamp: string;
  actor?: string;
  reason?: string;
}

// =============================================================================
// Alert Lifecycle Manager
// =============================================================================

export class AlertLifecycleManager {
  private config: Required<LifecycleConfig>;
  private states = new Map<string, AlertState>();
  private initialized = false;

  constructor(config: LifecycleConfig = {}) {
    this.config = {
      escalationTimeoutMs: config.escalationTimeoutMs ?? 30 * 60 * 1000, // 30 minutes
      maxEscalationLevel: config.maxEscalationLevel ?? 3,
      autoResolveDelayMs: config.autoResolveDelayMs ?? 5 * 60 * 1000, // 5 minutes
      reminderIntervalMs: config.reminderIntervalMs ?? 15 * 60 * 1000, // 15 minutes
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const client = getClient();

    // Create alert states table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS alert_states (
        alert_id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        status TEXT NOT NULL,
        severity TEXT NOT NULL,
        triggered_at TEXT NOT NULL,
        acknowledged_at TEXT,
        acknowledged_by TEXT,
        resolved_at TEXT,
        resolved_by TEXT,
        escalated_at TEXT,
        escalation_level INTEGER DEFAULT 0,
        notification_count INTEGER DEFAULT 0,
        last_notified_at TEXT,
        metadata TEXT
      )
    `);

    // Create transitions history table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS alert_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id TEXT NOT NULL,
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        actor TEXT,
        reason TEXT
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_alert_states_org
      ON alert_states (org_id)
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_alert_states_status
      ON alert_states (status)
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_alert_transitions_alert
      ON alert_transitions (alert_id)
    `);

    this.initialized = true;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Create initial state for a new alert
   */
  async createAlert(trigger: AlertTrigger): Promise<AlertState> {
    await this.initialize();

    const state: AlertState = {
      alertId: trigger.alert_id,
      ruleId: trigger.rule_id,
      orgId: trigger.org_id,
      status: 'firing',
      severity: trigger.severity,
      triggeredAt: trigger.triggered_at,
      escalationLevel: 0,
      notificationCount: 0,
    };

    await this.saveState(state);
    await this.recordTransition({
      alertId: state.alertId,
      fromStatus: 'firing',
      toStatus: 'firing',
      timestamp: state.triggeredAt,
      reason: 'Alert triggered',
    });

    this.states.set(state.alertId, state);

    logger.info('Alert created', {
      alertId: state.alertId,
      ruleId: state.ruleId,
      severity: state.severity,
    });

    return state;
  }

  /**
   * Get current state of an alert
   */
  async getState(alertId: string): Promise<AlertState | null> {
    // Check cache first
    if (this.states.has(alertId)) {
      return this.states.get(alertId)!;
    }

    await this.initialize();
    const client = getClient();

    const result = await client.execute({
      sql: 'SELECT * FROM alert_states WHERE alert_id = ?',
      args: [alertId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const state: AlertState = {
      alertId: row.alert_id as string,
      ruleId: row.rule_id as string,
      orgId: row.org_id as string,
      status: row.status as AlertStatus,
      severity: row.severity as AlertSeverity,
      triggeredAt: row.triggered_at as string,
      acknowledgedAt: row.acknowledged_at as string | undefined,
      acknowledgedBy: row.acknowledged_by as string | undefined,
      resolvedAt: row.resolved_at as string | undefined,
      resolvedBy: row.resolved_by as string | undefined,
      escalatedAt: row.escalated_at as string | undefined,
      escalationLevel: row.escalation_level as number,
      notificationCount: row.notification_count as number,
      lastNotifiedAt: row.last_notified_at as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };

    this.states.set(alertId, state);
    return state;
  }

  /**
   * List alerts by status
   */
  async listAlerts(
    orgId?: string,
    status?: AlertStatus[]
  ): Promise<AlertState[]> {
    await this.initialize();
    const client = getClient();

    let sql = 'SELECT * FROM alert_states WHERE 1=1';
    const args: (string | number | null)[] = [];

    if (orgId) {
      sql += ' AND org_id = ?';
      args.push(orgId);
    }

    if (status && status.length > 0) {
      sql += ` AND status IN (${status.map(() => '?').join(',')})`;
      args.push(...status);
    }

    sql += ' ORDER BY triggered_at DESC';

    const result = await client.execute({ sql, args });

    return result.rows.map((row) => ({
      alertId: row.alert_id as string,
      ruleId: row.rule_id as string,
      orgId: row.org_id as string,
      status: row.status as AlertStatus,
      severity: row.severity as AlertSeverity,
      triggeredAt: row.triggered_at as string,
      acknowledgedAt: row.acknowledged_at as string | undefined,
      acknowledgedBy: row.acknowledged_by as string | undefined,
      resolvedAt: row.resolved_at as string | undefined,
      resolvedBy: row.resolved_by as string | undefined,
      escalatedAt: row.escalated_at as string | undefined,
      escalationLevel: row.escalation_level as number,
      notificationCount: row.notification_count as number,
      lastNotifiedAt: row.last_notified_at as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    }));
  }

  // ==========================================================================
  // State Transitions
  // ==========================================================================

  /**
   * Acknowledge an alert
   */
  async acknowledge(alertId: string, acknowledgedBy: string): Promise<AlertState | null> {
    const state = await this.getState(alertId);
    if (!state) return null;

    if (state.status !== 'firing' && state.status !== 'escalated') {
      logger.warn('Cannot acknowledge alert in current state', {
        alertId,
        currentStatus: state.status,
      });
      return state;
    }

    const now = new Date().toISOString();
    const oldStatus = state.status;

    state.status = 'acknowledged';
    state.acknowledgedAt = now;
    state.acknowledgedBy = acknowledgedBy;

    await this.saveState(state);
    await this.recordTransition({
      alertId,
      fromStatus: oldStatus,
      toStatus: 'acknowledged',
      timestamp: now,
      actor: acknowledgedBy,
      reason: 'Alert acknowledged',
    });

    logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy,
    });

    return state;
  }

  /**
   * Resolve an alert
   */
  async resolve(
    alertId: string,
    resolvedBy: string,
    reason?: string
  ): Promise<AlertState | null> {
    const state = await this.getState(alertId);
    if (!state) return null;

    if (state.status === 'resolved') {
      return state;
    }

    const now = new Date().toISOString();
    const oldStatus = state.status;

    state.status = 'resolved';
    state.resolvedAt = now;
    state.resolvedBy = resolvedBy;

    await this.saveState(state);
    await this.recordTransition({
      alertId,
      fromStatus: oldStatus,
      toStatus: 'resolved',
      timestamp: now,
      actor: resolvedBy,
      reason: reason || 'Alert resolved',
    });

    logger.info('Alert resolved', {
      alertId,
      resolvedBy,
      reason,
    });

    return state;
  }

  /**
   * Escalate an alert
   */
  async escalate(alertId: string, reason?: string): Promise<AlertState | null> {
    const state = await this.getState(alertId);
    if (!state) return null;

    if (state.status === 'resolved') {
      return state;
    }

    if (state.escalationLevel >= this.config.maxEscalationLevel) {
      logger.warn('Alert at max escalation level', {
        alertId,
        level: state.escalationLevel,
      });
      return state;
    }

    const now = new Date().toISOString();
    const oldStatus = state.status;

    state.status = 'escalated';
    state.escalatedAt = now;
    state.escalationLevel++;

    await this.saveState(state);
    await this.recordTransition({
      alertId,
      fromStatus: oldStatus,
      toStatus: 'escalated',
      timestamp: now,
      reason: reason || `Escalated to level ${state.escalationLevel}`,
    });

    logger.info('Alert escalated', {
      alertId,
      level: state.escalationLevel,
      reason,
    });

    return state;
  }

  /**
   * Record notification sent
   */
  async recordNotification(alertId: string): Promise<void> {
    const state = await this.getState(alertId);
    if (!state) return;

    state.notificationCount++;
    state.lastNotifiedAt = new Date().toISOString();

    await this.saveState(state);
  }

  // ==========================================================================
  // Automated Lifecycle
  // ==========================================================================

  /**
   * Check for alerts that need escalation
   */
  async checkEscalations(): Promise<AlertState[]> {
    await this.initialize();
    const client = getClient();

    const cutoffTime = new Date(
      Date.now() - this.config.escalationTimeoutMs
    ).toISOString();

    const result = await client.execute({
      sql: `
        SELECT * FROM alert_states
        WHERE status = 'firing'
          AND triggered_at < ?
          AND escalation_level < ?
      `,
      args: [cutoffTime, this.config.maxEscalationLevel],
    });

    const escalated: AlertState[] = [];

    for (const row of result.rows) {
      const alertId = row.alert_id as string;
      const state = await this.escalate(alertId, 'Auto-escalation timeout');
      if (state && state.status === 'escalated') {
        escalated.push(state);
      }
    }

    return escalated;
  }

  /**
   * Check for alerts that need reminders
   */
  async checkReminders(): Promise<AlertState[]> {
    await this.initialize();
    const client = getClient();

    const cutoffTime = new Date(
      Date.now() - this.config.reminderIntervalMs
    ).toISOString();

    const result = await client.execute({
      sql: `
        SELECT * FROM alert_states
        WHERE status IN ('firing', 'escalated')
          AND (last_notified_at IS NULL OR last_notified_at < ?)
      `,
      args: [cutoffTime],
    });

    return result.rows.map((row) => ({
      alertId: row.alert_id as string,
      ruleId: row.rule_id as string,
      orgId: row.org_id as string,
      status: row.status as AlertStatus,
      severity: row.severity as AlertSeverity,
      triggeredAt: row.triggered_at as string,
      acknowledgedAt: row.acknowledged_at as string | undefined,
      acknowledgedBy: row.acknowledged_by as string | undefined,
      resolvedAt: row.resolved_at as string | undefined,
      resolvedBy: row.resolved_by as string | undefined,
      escalatedAt: row.escalated_at as string | undefined,
      escalationLevel: row.escalation_level as number,
      notificationCount: row.notification_count as number,
      lastNotifiedAt: row.last_notified_at as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    }));
  }

  /**
   * Get transition history for an alert
   */
  async getHistory(alertId: string): Promise<StateTransition[]> {
    await this.initialize();
    const client = getClient();

    const result = await client.execute({
      sql: `
        SELECT * FROM alert_transitions
        WHERE alert_id = ?
        ORDER BY timestamp ASC
      `,
      args: [alertId],
    });

    return result.rows.map((row) => ({
      alertId: row.alert_id as string,
      fromStatus: row.from_status as AlertStatus,
      toStatus: row.to_status as AlertStatus,
      timestamp: row.timestamp as string,
      actor: row.actor as string | undefined,
      reason: row.reason as string | undefined,
    }));
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get alert statistics for an org
   */
  async getStatistics(orgId: string): Promise<{
    total: number;
    byStatus: Record<AlertStatus, number>;
    bySeverity: Record<string, number>;
    mttr: number; // Mean time to resolve
    mtfr: number; // Mean time to first response
  }> {
    await this.initialize();
    const client = getClient();

    const statusResult = await client.execute({
      sql: `
        SELECT status, COUNT(*) as count
        FROM alert_states
        WHERE org_id = ?
        GROUP BY status
      `,
      args: [orgId],
    });

    const severityResult = await client.execute({
      sql: `
        SELECT severity, COUNT(*) as count
        FROM alert_states
        WHERE org_id = ?
        GROUP BY severity
      `,
      args: [orgId],
    });

    const byStatus: Record<AlertStatus, number> = {
      firing: 0,
      acknowledged: 0,
      resolved: 0,
      escalated: 0,
    };

    for (const row of statusResult.rows) {
      byStatus[row.status as AlertStatus] = row.count as number;
    }

    const bySeverity: Record<string, number> = {};
    for (const row of severityResult.rows) {
      bySeverity[row.severity as string] = row.count as number;
    }

    // Calculate MTTR (resolved alerts only)
    const mttrResult = await client.execute({
      sql: `
        SELECT AVG(
          (julianday(resolved_at) - julianday(triggered_at)) * 24 * 60
        ) as avg_minutes
        FROM alert_states
        WHERE org_id = ? AND resolved_at IS NOT NULL
      `,
      args: [orgId],
    });

    const mttr = Number(mttrResult.rows[0]?.avg_minutes || 0);

    // Calculate MTFR (acknowledged alerts)
    const mtfrResult = await client.execute({
      sql: `
        SELECT AVG(
          (julianday(acknowledged_at) - julianday(triggered_at)) * 24 * 60
        ) as avg_minutes
        FROM alert_states
        WHERE org_id = ? AND acknowledged_at IS NOT NULL
      `,
      args: [orgId],
    });

    const mtfr = Number(mtfrResult.rows[0]?.avg_minutes || 0);

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

    return {
      total,
      byStatus,
      bySeverity,
      mttr,
      mtfr,
    };
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  private async saveState(state: AlertState): Promise<void> {
    const client = getClient();

    await client.execute({
      sql: `
        INSERT OR REPLACE INTO alert_states
        (alert_id, rule_id, org_id, status, severity, triggered_at,
         acknowledged_at, acknowledged_by, resolved_at, resolved_by,
         escalated_at, escalation_level, notification_count, last_notified_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        state.alertId,
        state.ruleId,
        state.orgId,
        state.status,
        state.severity,
        state.triggeredAt,
        state.acknowledgedAt || null,
        state.acknowledgedBy || null,
        state.resolvedAt || null,
        state.resolvedBy || null,
        state.escalatedAt || null,
        state.escalationLevel,
        state.notificationCount,
        state.lastNotifiedAt || null,
        state.metadata ? JSON.stringify(state.metadata) : null,
      ],
    });

    this.states.set(state.alertId, state);
  }

  private async recordTransition(transition: StateTransition): Promise<void> {
    const client = getClient();

    await client.execute({
      sql: `
        INSERT INTO alert_transitions
        (alert_id, from_status, to_status, timestamp, actor, reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        transition.alertId,
        transition.fromStatus,
        transition.toStatus,
        transition.timestamp,
        transition.actor || null,
        transition.reason || null,
      ],
    });
  }
}

// =============================================================================
// Factory
// =============================================================================

let _lifecycle: AlertLifecycleManager | null = null;

export function getAlertLifecycleManager(
  config?: LifecycleConfig
): AlertLifecycleManager {
  if (!_lifecycle) {
    _lifecycle = new AlertLifecycleManager(config);
  }
  return _lifecycle;
}

export function resetAlertLifecycleManager(): void {
  _lifecycle = null;
}
