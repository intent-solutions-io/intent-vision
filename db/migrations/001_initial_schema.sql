-- IntentVision Initial Schema
-- Migration: 001_initial_schema
-- Created: 2025-12-15
-- Task ID: intentvision-w7a

-- =============================================================================
-- Migrations tracking table
-- =============================================================================

CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- Organizations (multi-tenant support)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    org_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- Canonical Metrics (the spine)
-- =============================================================================

CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    metric_key TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    value REAL NOT NULL,
    dimensions TEXT NOT NULL DEFAULT '{}',  -- JSON
    provenance TEXT NOT NULL DEFAULT '{}',  -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Indexes for common queries
    UNIQUE(org_id, metric_key, timestamp, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_metrics_org_key ON metrics(org_id, metric_key);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_org_timestamp ON metrics(org_id, timestamp);

-- =============================================================================
-- Time Series (aggregated series for queries)
-- =============================================================================

CREATE TABLE IF NOT EXISTS time_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    metric_key TEXT NOT NULL,
    dimensions TEXT NOT NULL DEFAULT '{}',  -- JSON
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    point_count INTEGER NOT NULL,
    resolution TEXT,  -- e.g., "1m", "5m", "1h"
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(org_id, metric_key, dimensions, start_time, end_time)
);

-- =============================================================================
-- Forecasts
-- =============================================================================

CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL UNIQUE,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    metric_key TEXT NOT NULL,
    dimensions TEXT NOT NULL DEFAULT '{}',  -- JSON
    backend TEXT NOT NULL,  -- 'nixtla-timegpt', 'vertex-ai', etc.
    horizon INTEGER NOT NULL,
    frequency TEXT NOT NULL,
    predictions TEXT NOT NULL,  -- JSON array of ForecastPoint
    model_info TEXT,  -- JSON
    generated_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_forecasts_org ON forecasts(org_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_metric ON forecasts(org_id, metric_key);

-- =============================================================================
-- Anomalies
-- =============================================================================

CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anomaly_id TEXT NOT NULL UNIQUE,
    request_id TEXT NOT NULL,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    metric_key TEXT NOT NULL,
    dimensions TEXT NOT NULL DEFAULT '{}',  -- JSON
    timestamp TEXT NOT NULL,
    observed_value REAL NOT NULL,
    expected_value REAL NOT NULL,
    score REAL NOT NULL,
    type TEXT NOT NULL,  -- 'point', 'contextual', etc.
    severity TEXT NOT NULL,  -- 'low', 'medium', 'high', 'critical'
    description TEXT NOT NULL,
    context TEXT,  -- JSON
    detected_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anomalies_org ON anomalies(org_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp);

-- =============================================================================
-- Alerts
-- =============================================================================

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id TEXT NOT NULL UNIQUE,
    rule_id TEXT NOT NULL,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    triggered_at TEXT NOT NULL,
    severity TEXT NOT NULL,  -- 'info', 'warning', 'error', 'critical'
    status TEXT NOT NULL,  -- 'firing', 'pending', 'resolved', etc.
    trigger_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    metric_context TEXT NOT NULL,  -- JSON
    trigger_details TEXT NOT NULL,  -- JSON
    routing TEXT NOT NULL,  -- JSON
    lifecycle TEXT NOT NULL,  -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- =============================================================================
-- Alert Rules
-- =============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL UNIQUE,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    name TEXT NOT NULL,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    metric_key TEXT NOT NULL,
    dimension_filters TEXT,  -- JSON
    condition TEXT NOT NULL,  -- JSON
    severity TEXT NOT NULL,
    routing TEXT NOT NULL,  -- JSON
    suppression TEXT,  -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(org_id, enabled);

-- =============================================================================
-- Ingestion Sources
-- =============================================================================

CREATE TABLE IF NOT EXISTS ingestion_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL UNIQUE,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    type TEXT NOT NULL,  -- 'prometheus', 'datadog', etc.
    config TEXT NOT NULL,  -- JSON
    default_dimensions TEXT,  -- JSON
    metric_mappings TEXT,  -- JSON
    enabled INTEGER NOT NULL DEFAULT 1,
    last_sync_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Record this migration
INSERT INTO _migrations (name) VALUES ('001_initial_schema');
