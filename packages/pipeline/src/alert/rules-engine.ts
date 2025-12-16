/**
 * Alerting Rules Engine
 *
 * Task ID: intentvision-9ru.1
 *
 * Evaluates alert rules against metrics, forecasts, and anomalies.
 * Supports threshold, anomaly, forecast, rate-of-change, and missing data conditions.
 */

import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../../../../db/config.js';
import type {
  AlertRule,
  AlertTrigger,
  AlertCondition,
  AlertSeverity,
  AlertTriggerType,
  CanonicalMetric,
  TimeSeries,
  Anomaly,
  ForecastPoint,
} from '../../../contracts/src/index.js';

// =============================================================================
// Types
// =============================================================================

export interface RuleEvaluationContext {
  metric?: CanonicalMetric;
  series?: TimeSeries;
  anomalies?: Anomaly[];
  forecasts?: ForecastPoint[];
  previousValue?: number;
  lastSeenAt?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  matched: boolean;
  trigger?: AlertTrigger;
  reason: string;
  evaluatedAt: string;
}

export interface RulesEngineConfig {
  /** Enable rule evaluation */
  enabled?: boolean;
  /** Check interval in ms */
  checkIntervalMs?: number;
  /** Max rules to evaluate per batch */
  batchSize?: number;
}

// =============================================================================
// Rules Engine
// =============================================================================

export class RulesEngine {
  private rules = new Map<string, AlertRule>();
  private config: Required<RulesEngineConfig>;

  constructor(config: RulesEngineConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      checkIntervalMs: config.checkIntervalMs ?? 60000,
      batchSize: config.batchSize ?? 100,
    };
  }

  // ==========================================================================
  // Rule Management
  // ==========================================================================

  /**
   * Register an alert rule
   */
  registerRule(rule: AlertRule): void {
    this.rules.set(rule.rule_id, rule);
  }

  /**
   * Unregister a rule
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get a rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * List all rules
   */
  listRules(orgId?: string): AlertRule[] {
    const rules = Array.from(this.rules.values());
    if (orgId) {
      return rules.filter((r) => r.org_id === orgId);
    }
    return rules;
  }

  /**
   * Load rules from database
   */
  async loadRulesFromDb(orgId?: string): Promise<number> {
    const client = getClient();

    let sql = 'SELECT * FROM alert_rules WHERE enabled = 1';
    const args: (string | number | null)[] = [];

    if (orgId) {
      sql += ' AND org_id = ?';
      args.push(orgId);
    }

    const result = await client.execute({ sql, args });

    for (const row of result.rows) {
      const rule: AlertRule = {
        rule_id: row.rule_id as string,
        org_id: row.org_id as string,
        name: row.name as string,
        description: row.description as string,
        enabled: Boolean(row.enabled),
        metric_key: row.metric_key as string,
        dimension_filters: row.dimension_filters
          ? JSON.parse(row.dimension_filters as string)
          : undefined,
        condition: JSON.parse(row.condition as string),
        severity: row.severity as AlertSeverity,
        routing: JSON.parse(row.routing as string),
        suppression: row.suppression
          ? JSON.parse(row.suppression as string)
          : undefined,
      };
      this.registerRule(rule);
    }

    return result.rows.length;
  }

  /**
   * Save a rule to database
   */
  async saveRule(rule: AlertRule): Promise<void> {
    const client = getClient();

    await client.execute({
      sql: `
        INSERT OR REPLACE INTO alert_rules
        (rule_id, org_id, name, description, enabled, metric_key,
         dimension_filters, condition, severity, routing, suppression)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        rule.rule_id,
        rule.org_id,
        rule.name,
        rule.description,
        rule.enabled ? 1 : 0,
        rule.metric_key,
        rule.dimension_filters ? JSON.stringify(rule.dimension_filters) : null,
        JSON.stringify(rule.condition),
        rule.severity,
        JSON.stringify(rule.routing),
        rule.suppression ? JSON.stringify(rule.suppression) : null,
      ],
    });

    this.registerRule(rule);
  }

  // ==========================================================================
  // Rule Evaluation
  // ==========================================================================

  /**
   * Evaluate all rules against a context
   */
  evaluateRules(context: RuleEvaluationContext): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check if rule applies to this metric
      if (context.metric && !this.ruleApplies(rule, context.metric)) {
        continue;
      }

      const result = this.evaluateRule(rule, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Evaluate a single rule
   */
  evaluateRule(rule: AlertRule, context: RuleEvaluationContext): RuleEvaluationResult {
    const evaluatedAt = new Date().toISOString();

    try {
      const { matched, reason, triggerDetails } = this.evaluateCondition(
        rule.condition,
        context
      );

      if (matched && context.metric) {
        const trigger = this.createTrigger(rule, context, triggerDetails);
        return {
          ruleId: rule.rule_id,
          matched: true,
          trigger,
          reason,
          evaluatedAt,
        };
      }

      return {
        ruleId: rule.rule_id,
        matched: false,
        reason: reason || 'Condition not met',
        evaluatedAt,
      };
    } catch (error) {
      return {
        ruleId: rule.rule_id,
        matched: false,
        reason: `Evaluation error: ${(error as Error).message}`,
        evaluatedAt,
      };
    }
  }

  // ==========================================================================
  // Condition Evaluation
  // ==========================================================================

  private evaluateCondition(
    condition: AlertCondition,
    context: RuleEvaluationContext
  ): { matched: boolean; reason: string; triggerDetails: Record<string, unknown> } {
    switch (condition.type) {
      case 'threshold':
        return this.evaluateThresholdCondition(condition, context);

      case 'anomaly':
        return this.evaluateAnomalyCondition(condition, context);

      case 'forecast':
        return this.evaluateForecastCondition(condition, context);

      case 'rate_of_change':
        return this.evaluateRateOfChangeCondition(condition, context);

      case 'missing_data':
        return this.evaluateMissingDataCondition(condition, context);

      default:
        return {
          matched: false,
          reason: `Unknown condition type: ${(condition as AlertCondition).type}`,
          triggerDetails: {},
        };
    }
  }

  private evaluateThresholdCondition(
    condition: { type: 'threshold'; operator: string; value: number; duration_ms?: number },
    context: RuleEvaluationContext
  ): { matched: boolean; reason: string; triggerDetails: Record<string, unknown> } {
    if (!context.metric) {
      return {
        matched: false,
        reason: 'No metric provided',
        triggerDetails: {},
      };
    }

    const { operator, value } = condition;
    const actual = context.metric.value;
    let matched = false;

    switch (operator) {
      case 'gt':
        matched = actual > value;
        break;
      case 'gte':
        matched = actual >= value;
        break;
      case 'lt':
        matched = actual < value;
        break;
      case 'lte':
        matched = actual <= value;
        break;
      case 'eq':
        matched = actual === value;
        break;
      case 'neq':
        matched = actual !== value;
        break;
    }

    return {
      matched,
      reason: matched
        ? `Value ${actual} ${operator} ${value}`
        : `Value ${actual} does not match ${operator} ${value}`,
      triggerDetails: {
        type: 'threshold',
        operator,
        threshold: value,
        actual_value: actual,
      },
    };
  }

  private evaluateAnomalyCondition(
    condition: { type: 'anomaly'; min_severity: string },
    context: RuleEvaluationContext
  ): { matched: boolean; reason: string; triggerDetails: Record<string, unknown> } {
    if (!context.anomalies || context.anomalies.length === 0) {
      return {
        matched: false,
        reason: 'No anomalies to evaluate',
        triggerDetails: {},
      };
    }

    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const minIndex = severityOrder.indexOf(condition.min_severity);

    const matchingAnomalies = context.anomalies.filter((a) => {
      const anomalyIndex = severityOrder.indexOf(a.severity);
      return anomalyIndex >= minIndex;
    });

    if (matchingAnomalies.length > 0) {
      const anomaly = matchingAnomalies[0];
      return {
        matched: true,
        reason: `Anomaly detected with severity ${anomaly.severity}`,
        triggerDetails: {
          type: 'anomaly',
          anomaly,
          detection_method: 'ensemble',
        },
      };
    }

    return {
      matched: false,
      reason: `No anomalies at or above ${condition.min_severity} severity`,
      triggerDetails: {},
    };
  }

  private evaluateForecastCondition(
    condition: { type: 'forecast'; horizon_hours: number; threshold: number },
    context: RuleEvaluationContext
  ): { matched: boolean; reason: string; triggerDetails: Record<string, unknown> } {
    if (!context.forecasts || context.forecasts.length === 0) {
      return {
        matched: false,
        reason: 'No forecasts to evaluate',
        triggerDetails: {},
      };
    }

    const horizonMs = condition.horizon_hours * 60 * 60 * 1000;
    const now = Date.now();

    const breachingForecasts = context.forecasts.filter((f) => {
      const forecastTime = new Date(f.timestamp).getTime();
      return forecastTime <= now + horizonMs && f.value > condition.threshold;
    });

    if (breachingForecasts.length > 0) {
      const forecast = breachingForecasts[0];
      return {
        matched: true,
        reason: `Forecast predicts ${forecast.value.toFixed(2)} exceeds threshold ${condition.threshold}`,
        triggerDetails: {
          type: 'forecast',
          predicted_value: forecast.value,
          prediction_timestamp: forecast.timestamp,
          confidence_interval: forecast.intervals?.['0.95'],
          threshold_will_breach_at: forecast.timestamp,
        },
      };
    }

    return {
      matched: false,
      reason: `No forecasts breach threshold ${condition.threshold} within ${condition.horizon_hours}h`,
      triggerDetails: {},
    };
  }

  private evaluateRateOfChangeCondition(
    condition: { type: 'rate_of_change'; max_rate: number; rate_unit: string },
    context: RuleEvaluationContext
  ): { matched: boolean; reason: string; triggerDetails: Record<string, unknown> } {
    if (!context.metric || context.previousValue === undefined) {
      return {
        matched: false,
        reason: 'Cannot calculate rate without current and previous values',
        triggerDetails: {},
      };
    }

    const change = context.metric.value - context.previousValue;
    const rate = Math.abs(change);

    if (rate > condition.max_rate) {
      return {
        matched: true,
        reason: `Rate ${rate.toFixed(2)} exceeds max ${condition.max_rate} ${condition.rate_unit}`,
        triggerDetails: {
          type: 'rate_of_change',
          rate,
          rate_unit: condition.rate_unit,
          max_allowed_rate: condition.max_rate,
        },
      };
    }

    return {
      matched: false,
      reason: `Rate ${rate.toFixed(2)} within allowed ${condition.max_rate}`,
      triggerDetails: {},
    };
  }

  private evaluateMissingDataCondition(
    condition: { type: 'missing_data'; expected_interval_ms: number },
    context: RuleEvaluationContext
  ): { matched: boolean; reason: string; triggerDetails: Record<string, unknown> } {
    if (!context.lastSeenAt) {
      return {
        matched: true,
        reason: 'No data has been seen',
        triggerDetails: {
          type: 'missing_data',
          expected_interval_ms: condition.expected_interval_ms,
          missing_duration_ms: Infinity,
        },
      };
    }

    const lastSeen = new Date(context.lastSeenAt).getTime();
    const now = Date.now();
    const missingDuration = now - lastSeen;

    if (missingDuration > condition.expected_interval_ms) {
      return {
        matched: true,
        reason: `Data missing for ${Math.round(missingDuration / 1000)}s (expected every ${Math.round(condition.expected_interval_ms / 1000)}s)`,
        triggerDetails: {
          type: 'missing_data',
          expected_interval_ms: condition.expected_interval_ms,
          last_seen_at: context.lastSeenAt,
          missing_duration_ms: missingDuration,
        },
      };
    }

    return {
      matched: false,
      reason: 'Data is within expected interval',
      triggerDetails: {},
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private ruleApplies(rule: AlertRule, metric: CanonicalMetric): boolean {
    // Check metric key
    if (rule.metric_key !== metric.metric_key) {
      return false;
    }

    // Check org_id
    if (rule.org_id !== metric.org_id) {
      return false;
    }

    // Check dimension filters
    if (rule.dimension_filters) {
      for (const [key, value] of Object.entries(rule.dimension_filters)) {
        if (metric.dimensions[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private createTrigger(
    rule: AlertRule,
    context: RuleEvaluationContext,
    triggerDetails: Record<string, unknown>
  ): AlertTrigger {
    const metric = context.metric!;
    const alertId = `alert-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const triggerType = triggerDetails.type as AlertTriggerType;

    return {
      alert_id: alertId,
      rule_id: rule.rule_id,
      org_id: metric.org_id,
      triggered_at: now,
      severity: rule.severity,
      status: 'firing',
      trigger_type: triggerType,
      title: `[${rule.severity.toUpperCase()}] ${rule.name}`,
      description: rule.description,
      metric_context: {
        metric_key: metric.metric_key,
        dimensions: metric.dimensions,
        current_value: metric.value,
        recent_values: context.series?.data_points.slice(-5) || [],
      },
      trigger_details: triggerDetails as AlertTrigger['trigger_details'],
      routing: rule.routing,
      lifecycle: {
        triggered_at: now,
        notification_count: 0,
      },
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

let _engine: RulesEngine | null = null;

export function getRulesEngine(config?: RulesEngineConfig): RulesEngine {
  if (!_engine) {
    _engine = new RulesEngine(config);
  }
  return _engine;
}

export function resetRulesEngine(): void {
  _engine = null;
}

export function createRulesEngine(config?: RulesEngineConfig): RulesEngine {
  return new RulesEngine(config);
}
