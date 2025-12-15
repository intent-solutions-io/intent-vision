-- IntentVision SaaS Tables Migration
-- Migration: 002_saas_tables
-- Created: 2025-12-15
-- Task ID: intentvision-5ba
-- Phase: A - Stack Alignment & Storage Design

-- =============================================================================
-- Users (for SaaS login, linked to organizations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT,  -- NULL if using external auth (Firebase, etc.)
    auth_provider TEXT DEFAULT 'internal',  -- 'internal', 'firebase', 'google'
    external_id TEXT,  -- Firebase UID or OAuth ID
    default_org_id TEXT REFERENCES organizations(org_id),
    email_verified INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_external ON users(auth_provider, external_id);

-- =============================================================================
-- User-Organization Membership (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_org_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(user_id),
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    role TEXT NOT NULL DEFAULT 'member',  -- 'owner', 'admin', 'member', 'viewer'
    invited_by TEXT REFERENCES users(user_id),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON user_org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON user_org_memberships(org_id);

-- =============================================================================
-- Connections (data source integrations, future Airbyte support)
-- =============================================================================

CREATE TABLE IF NOT EXISTS connections (
    connection_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'webhook', 'api', 'airbyte', 'stripe', 'posthog', etc.
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'active', 'error', 'disabled'
    config TEXT NOT NULL DEFAULT '{}',  -- JSON: endpoint, credentials ref, etc.
    last_sync_at TEXT,
    last_error TEXT,
    metrics_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_connections_org ON connections(org_id);
CREATE INDEX IF NOT EXISTS idx_connections_type ON connections(type);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(org_id, status);

-- =============================================================================
-- API Keys (move from dynamic creation to migration for consistency)
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    key_id TEXT PRIMARY KEY,
    key_hash TEXT UNIQUE NOT NULL,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    user_id TEXT REFERENCES users(user_id),  -- Optional: which user created it
    name TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '["read"]',  -- JSON array
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    last_used_at TEXT,
    rate_limit INTEGER DEFAULT 1000,
    enabled INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- =============================================================================
-- Forecast Jobs (track scheduled/on-demand forecast runs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS forecast_jobs (
    job_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    metric_key TEXT NOT NULL,
    dimensions TEXT DEFAULT '{}',  -- JSON
    backend TEXT NOT NULL DEFAULT 'nixtla-timegpt',
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
    horizon INTEGER NOT NULL DEFAULT 12,
    frequency TEXT NOT NULL DEFAULT '1h',
    started_at TEXT,
    completed_at TEXT,
    error TEXT,
    forecast_id TEXT REFERENCES forecasts(request_id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_forecast_jobs_org ON forecast_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_forecast_jobs_status ON forecast_jobs(status);

-- =============================================================================
-- Notification Channels (per-org alerting destinations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_channels (
    channel_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'webhook', 'email', 'slack', 'pagerduty'
    config TEXT NOT NULL DEFAULT '{}',  -- JSON: url, api_key ref, etc.
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_org ON notification_channels(org_id);

-- Record this migration
INSERT INTO _migrations (name) VALUES ('002_saas_tables');
