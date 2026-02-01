/**
 * Environment Configuration for IntentVision
 *
 * Phase 13: Production Deployment Infrastructure
 *
 * Centralized environment-aware configuration for:
 * - Database URLs (LibSQL/Turso)
 * - API URLs
 * - Firebase project IDs
 * - Environment detection
 *
 * Environment Variables:
 * - INTENTVISION_ENV: local | staging | production (default: local)
 * - INTENTVISION_DB_URL: Database connection URL
 * - INTENTVISION_DB_AUTH_TOKEN: Database auth token (staging/prod)
 * - INTENTVISION_API_URL: Public API URL
 * - INTENTVISION_FIREBASE_PROJECT_ID: Firebase project ID
 * - PORT: Server port (default: 8080)
 */

// =============================================================================
// Types
// =============================================================================

export type Environment = 'local' | 'staging' | 'production';

export interface EnvironmentConfig {
  /** Current environment */
  env: Environment;

  /** Whether running in production */
  isProduction: boolean;

  /** Whether running in staging */
  isStaging: boolean;

  /** Whether running locally */
  isLocal: boolean;

  /** Server port */
  port: number;

  /** Database configuration */
  database: {
    url: string;
    authToken?: string;
  };

  /** API configuration */
  api: {
    url: string;
    baseUrl: string;
  };

  /** Firebase configuration */
  firebase: {
    projectId: string;
    region: string;
  };

  /** Feature flags */
  features: {
    /** Enable verbose logging */
    verboseLogging: boolean;
    /** Enable performance monitoring */
    performanceMonitoring: boolean;
    /** Enable error reporting */
    errorReporting: boolean;
  };
}

// =============================================================================
// Environment Detection
// =============================================================================

/**
 * Get current environment from INTENTVISION_ENV variable
 */
export function getEnvironment(): Environment {
  const env = process.env.INTENTVISION_ENV?.toLowerCase().trim();

  switch (env) {
    case 'production':
    case 'prod':
      return 'production';
    case 'staging':
    case 'stage':
      return 'staging';
    case 'local':
    case 'dev':
    case 'development':
      return 'local';
    default:
      // Default to local for safety
      return 'local';
  }
}

// =============================================================================
// Database Configuration
// =============================================================================

/**
 * Get database URL for current environment
 */
function getDatabaseUrl(env: Environment): string {
  // Explicit URL takes precedence
  if (process.env.INTENTVISION_DB_URL) {
    return process.env.INTENTVISION_DB_URL;
  }

  // Environment-specific defaults
  switch (env) {
    case 'production':
      return process.env.PROD_DB_URL || 'libsql://intentvision-prod.turso.io';
    case 'staging':
      return process.env.STAGING_DB_URL || 'libsql://intentvision-staging.turso.io';
    case 'local':
    default:
      return process.env.LOCAL_DB_URL || 'file:./db/intentvision.db';
  }
}

/**
 * Get database auth token for current environment
 */
function getDatabaseAuthToken(env: Environment): string | undefined {
  // Explicit token takes precedence
  if (process.env.INTENTVISION_DB_AUTH_TOKEN) {
    return process.env.INTENTVISION_DB_AUTH_TOKEN;
  }

  // Environment-specific tokens
  switch (env) {
    case 'production':
      return process.env.PROD_DB_AUTH_TOKEN;
    case 'staging':
      return process.env.STAGING_DB_AUTH_TOKEN;
    case 'local':
    default:
      // Local SQLite doesn't need auth token
      return undefined;
  }
}

// =============================================================================
// API Configuration
// =============================================================================

/**
 * Get API URL for current environment
 */
function getApiUrl(env: Environment): string {
  // Explicit URL takes precedence
  if (process.env.INTENTVISION_API_URL) {
    return process.env.INTENTVISION_API_URL;
  }

  // Environment-specific defaults
  switch (env) {
    case 'production':
      return 'https://api.intentvision.io';
    case 'staging':
      return 'https://api-staging.intentvision.io';
    case 'local':
    default:
      return `http://localhost:${process.env.PORT || 8080}`;
  }
}

/**
 * Extract base URL (without /v1 suffix)
 */
function getApiBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/v1\/?$/, '');
}

// =============================================================================
// Firebase Configuration
// =============================================================================

/**
 * Get Firebase project ID for current environment
 */
function getFirebaseProjectId(env: Environment): string {
  // Explicit project ID takes precedence
  if (process.env.INTENTVISION_FIREBASE_PROJECT_ID) {
    return process.env.INTENTVISION_FIREBASE_PROJECT_ID;
  }

  // Environment-specific defaults
  switch (env) {
    case 'production':
      return process.env.FIREBASE_PROJECT_ID_PROD || 'intentvision-prod';
    case 'staging':
      return process.env.FIREBASE_PROJECT_ID_STAGING || 'intentvision-staging';
    case 'local':
    default:
      return process.env.FIREBASE_PROJECT_ID_DEV || 'intentvision-dev';
  }
}

/**
 * Get Firebase region
 */
function getFirebaseRegion(): string {
  return process.env.FIREBASE_REGION || 'us-central1';
}

// =============================================================================
// Feature Flags
// =============================================================================

/**
 * Get feature flags for current environment
 */
function getFeatureFlags(env: Environment) {
  return {
    verboseLogging: env === 'local' || process.env.VERBOSE_LOGGING === 'true',
    performanceMonitoring: env === 'production' || env === 'staging',
    errorReporting: env === 'production' || env === 'staging',
  };
}

// =============================================================================
// Main Configuration Builder
// =============================================================================

/**
 * Build complete environment configuration
 */
export function getConfig(): EnvironmentConfig {
  const env = getEnvironment();
  const apiUrl = getApiUrl(env);

  return {
    env,
    isProduction: env === 'production',
    isStaging: env === 'staging',
    isLocal: env === 'local',
    port: parseInt(process.env.PORT || '8080', 10),

    database: {
      url: getDatabaseUrl(env),
      authToken: getDatabaseAuthToken(env),
    },

    api: {
      url: apiUrl,
      baseUrl: getApiBaseUrl(apiUrl),
    },

    firebase: {
      projectId: getFirebaseProjectId(env),
      region: getFirebaseRegion(),
    },

    features: getFeatureFlags(env),
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate configuration for current environment
 */
export function validateConfig(config: EnvironmentConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Production/Staging require auth tokens for remote databases
  if ((config.isProduction || config.isStaging) &&
      config.database.url.startsWith('libsql://') &&
      !config.database.authToken) {
    errors.push(`${config.env.toUpperCase()}: Database auth token required for remote LibSQL/Turso`);
  }

  // Production/Staging require valid Firebase project IDs
  if ((config.isProduction || config.isStaging) &&
      !config.firebase.projectId) {
    errors.push(`${config.env.toUpperCase()}: Firebase project ID is required`);
  }

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Logging & Debugging
// =============================================================================

/**
 * Log current configuration (safe for logs - no secrets)
 */
export function logConfig(config?: EnvironmentConfig): void {
  const cfg = config || getConfig();

  console.log('[Config] Environment Configuration:');
  console.log(`  Environment: ${cfg.env}`);
  console.log(`  Port: ${cfg.port}`);
  console.log('[Config] Database:');
  console.log(`  URL: ${maskSensitive(cfg.database.url)}`);
  console.log(`  Auth Token: ${cfg.database.authToken ? '***SET***' : 'NOT SET'}`);
  console.log('[Config] API:');
  console.log(`  URL: ${cfg.api.url}`);
  console.log(`  Base URL: ${cfg.api.baseUrl}`);
  console.log('[Config] Firebase:');
  console.log(`  Project ID: ${cfg.firebase.projectId}`);
  console.log(`  Region: ${cfg.firebase.region}`);
  console.log('[Config] Features:');
  console.log(`  Verbose Logging: ${cfg.features.verboseLogging}`);
  console.log(`  Performance Monitoring: ${cfg.features.performanceMonitoring}`);
  console.log(`  Error Reporting: ${cfg.features.errorReporting}`);
}

/**
 * Mask sensitive parts of connection strings
 */
function maskSensitive(str: string): string {
  // Mask auth tokens in URLs
  return str.replace(/authToken=[^&]+/g, 'authToken=***');
}

// =============================================================================
// Exports
// =============================================================================

export default {
  getEnvironment,
  getConfig,
  validateConfig,
  logConfig,
};
