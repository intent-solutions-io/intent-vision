/**
 * Service Level Objectives (SLOs) Configuration
 *
 * Phase 20: Load/Resilience Testing and Production Readiness Review
 *
 * Defines SLOs for IntentVision API and load testing profiles.
 * These targets guide performance testing and monitoring thresholds.
 */

// =============================================================================
// SLO Types
// =============================================================================

export interface SLO {
  /** Name of the SLO */
  name: string;
  /** Target value */
  target: number;
  /** Unit of measurement (%, ms, etc.) */
  unit: string;
  /** How the SLO is measured */
  measurement: string;
}

// =============================================================================
// Service Level Objectives
// =============================================================================

/**
 * Core service SLOs for IntentVision
 *
 * These targets represent production-ready performance expectations:
 * - API Availability: 99.9% uptime (43.8 minutes downtime/month)
 * - Forecast Latency: Optimized for interactive use (p50) and reliability (p99)
 * - Ingestion Latency: Fast data intake for real-time monitoring
 * - Alert Delivery: Critical for operational reliability
 * - Error Rate: Low non-client errors indicate system health
 */
export const SERVICE_SLOS: SLO[] = [
  {
    name: 'API Availability',
    target: 99.9,
    unit: '%',
    measurement: 'Uptime over 30 days',
  },
  {
    name: 'Forecast Latency (p50)',
    target: 500,
    unit: 'ms',
    measurement: 'Median response time',
  },
  {
    name: 'Forecast Latency (p99)',
    target: 3000,
    unit: 'ms',
    measurement: '99th percentile',
  },
  {
    name: 'Ingestion Latency (p50)',
    target: 100,
    unit: 'ms',
    measurement: 'Median response time',
  },
  {
    name: 'Ingestion Latency (p99)',
    target: 500,
    unit: 'ms',
    measurement: '99th percentile',
  },
  {
    name: 'Alert Delivery',
    target: 99.5,
    unit: '%',
    measurement: 'Alerts delivered within 5 minutes',
  },
  {
    name: 'Error Rate',
    target: 0.1,
    unit: '%',
    measurement: 'Non-4xx server errors',
  },
];

// =============================================================================
// Load Profile Types
// =============================================================================

export interface LoadProfile {
  /** Profile name */
  name: string;
  /** Profile description */
  description: string;
  /** Number of organizations to simulate */
  orgsCount: number;
  /** Metrics per organization */
  metricsPerOrg: number;
  /** Forecast requests per day per org */
  forecastsPerDayPerOrg: number;
  /** Alert rules per organization */
  alertsPerOrg: number;
  /** Data points ingested per day */
  dataPointsPerDay: number;
}

// =============================================================================
// Load Profiles
// =============================================================================

/**
 * Load profiles for testing different scale scenarios
 *
 * baseline: Current expected production load
 * growth: 3x baseline - tests near-term scaling
 * stress: 10x baseline - finds breaking points
 */
export const LOAD_PROFILES: Record<string, LoadProfile> = {
  baseline: {
    name: 'Baseline',
    description: 'Current expected load',
    orgsCount: 100,
    metricsPerOrg: 10,
    forecastsPerDayPerOrg: 20,
    alertsPerOrg: 5,
    dataPointsPerDay: 1000,
  },
  growth: {
    name: 'Growth',
    description: '3x baseline',
    orgsCount: 300,
    metricsPerOrg: 25,
    forecastsPerDayPerOrg: 50,
    alertsPerOrg: 10,
    dataPointsPerDay: 5000,
  },
  stress: {
    name: 'Stress',
    description: '10x baseline',
    orgsCount: 1000,
    metricsPerOrg: 50,
    forecastsPerDayPerOrg: 100,
    alertsPerOrg: 20,
    dataPointsPerDay: 20000,
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get a load profile by name
 */
export function getLoadProfile(name: string): LoadProfile | undefined {
  return LOAD_PROFILES[name.toLowerCase()];
}

/**
 * Get all available profile names
 */
export function getProfileNames(): string[] {
  return Object.keys(LOAD_PROFILES);
}

/**
 * Calculate expected requests per second for a profile
 */
export function calculateRPS(profile: LoadProfile): {
  ingestionRPS: number;
  forecastRPS: number;
  totalRPS: number;
} {
  const secondsPerDay = 86400;

  // Ingestion: dataPointsPerDay spread across the day
  const ingestionRPS = (profile.orgsCount * profile.dataPointsPerDay) / secondsPerDay;

  // Forecasts: forecastsPerDayPerOrg spread across 8-hour business window
  const businessSeconds = 8 * 3600;
  const forecastRPS = (profile.orgsCount * profile.forecastsPerDayPerOrg) / businessSeconds;

  return {
    ingestionRPS: Math.round(ingestionRPS * 100) / 100,
    forecastRPS: Math.round(forecastRPS * 100) / 100,
    totalRPS: Math.round((ingestionRPS + forecastRPS) * 100) / 100,
  };
}

/**
 * Validate if measured latencies meet SLO targets
 */
export function validateSLO(
  sloName: string,
  actualValue: number
): { passed: boolean; target: number; actual: number; unit: string } | null {
  const slo = SERVICE_SLOS.find((s) => s.name === sloName);
  if (!slo) return null;

  // For latency SLOs, actual should be <= target
  // For availability/delivery SLOs, actual should be >= target
  // For error rate, actual should be <= target
  const isLatencyOrError = slo.unit === 'ms' || slo.name === 'Error Rate';
  const passed = isLatencyOrError ? actualValue <= slo.target : actualValue >= slo.target;

  return {
    passed,
    target: slo.target,
    actual: actualValue,
    unit: slo.unit,
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  SERVICE_SLOS,
  LOAD_PROFILES,
  getLoadProfile,
  getProfileNames,
  calculateRPS,
  validateSLO,
};
