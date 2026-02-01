/**
 * Environment Configuration
 *
 * Phase 9: Staging Cloud Run + Firestore + Cloud Smoke Tests
 * Beads Task: intentvision-vf7
 *
 * Centralized environment configuration for IntentVision.
 * Supports local, staging, and production environments.
 *
 * Environment Variables:
 * - NODE_ENV: development | test | staging | production
 * - INTENTVISION_ENV: local | dev | staging | prod
 * - INTENTVISION_FIRESTORE_PROJECT_ID: GCP project for Firestore
 * - INTENTVISION_FIRESTORE_COLLECTION_PREFIX: Collection prefix (optional)
 */

// =============================================================================
// Types
// =============================================================================

export type NodeEnv = 'development' | 'test' | 'staging' | 'production';
export type IntentVisionEnv = 'local' | 'dev' | 'staging' | 'prod';

export interface EnvironmentConfig {
  /** Node environment */
  nodeEnv: NodeEnv;
  /** IntentVision environment */
  env: IntentVisionEnv;
  /** Whether running in production mode */
  isProduction: boolean;
  /** Whether running in staging mode */
  isStaging: boolean;
  /** Whether running in development mode */
  isDevelopment: boolean;
  /** Whether running in test mode */
  isTest: boolean;
  /** Server port */
  port: number;
}

export interface FirestoreEnvConfig {
  /** GCP Project ID for Firestore */
  projectId: string | undefined;
  /** Database name (default: "(default)") */
  databaseId: string;
  /** Collection prefix for environment isolation */
  collectionPrefix: string;
  /** Environment name for collection paths */
  environment: IntentVisionEnv;
}

export interface AppConfig {
  /** Environment configuration */
  environment: EnvironmentConfig;
  /** Firestore configuration */
  firestore: FirestoreEnvConfig;
  /** Feature flags */
  features: {
    /** AgentFS enabled for internal tooling */
    agentFsEnabled: boolean;
    /** Beads enabled for internal task tracking */
    beadsEnabled: boolean;
  };
}

// =============================================================================
// Environment Detection
// =============================================================================

/**
 * Get the current Node environment
 */
export function getNodeEnv(): NodeEnv {
  const env = process.env.NODE_ENV?.toLowerCase();
  switch (env) {
    case 'production':
      return 'production';
    case 'staging':
      return 'staging';
    case 'test':
      return 'test';
    default:
      return 'development';
  }
}

/**
 * Get the IntentVision environment
 */
export function getIntentVisionEnv(): IntentVisionEnv {
  const env = process.env.INTENTVISION_ENV?.toLowerCase();
  switch (env) {
    case 'prod':
    case 'production':
      return 'prod';
    case 'staging':
    case 'stage':
      return 'staging';
    case 'dev':
    case 'development':
      return 'dev';
    default:
      return 'local';
  }
}

// =============================================================================
// Configuration Builders
// =============================================================================

/**
 * Build environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = getNodeEnv();
  const env = getIntentVisionEnv();

  return {
    nodeEnv,
    env,
    isProduction: nodeEnv === 'production' || env === 'prod',
    isStaging: nodeEnv === 'staging' || env === 'staging',
    isDevelopment: nodeEnv === 'development' && env !== 'staging' && env !== 'prod',
    isTest: nodeEnv === 'test',
    port: parseInt(process.env.PORT || '8080', 10),
  };
}

/**
 * Build Firestore configuration
 */
export function getFirestoreEnvConfig(): FirestoreEnvConfig {
  const env = getIntentVisionEnv();
  const projectId = process.env.INTENTVISION_FIRESTORE_PROJECT_ID ||
    process.env.INTENTVISION_GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT;

  // Determine collection prefix based on environment
  let collectionPrefix = process.env.INTENTVISION_FIRESTORE_COLLECTION_PREFIX;
  if (!collectionPrefix) {
    switch (env) {
      case 'prod':
        collectionPrefix = 'intentvision_prod_';
        break;
      case 'staging':
        collectionPrefix = 'intentvision_staging_';
        break;
      case 'dev':
        collectionPrefix = 'intentvision_dev_';
        break;
      default:
        collectionPrefix = 'intentvision_local_';
    }
  }

  return {
    projectId,
    databaseId: process.env.INTENTVISION_FIRESTORE_DB || '(default)',
    collectionPrefix,
    environment: env,
  };
}

/**
 * Get complete application configuration
 */
export function getAppConfig(): AppConfig {
  return {
    environment: getEnvironmentConfig(),
    firestore: getFirestoreEnvConfig(),
    features: {
      agentFsEnabled: process.env.INTENTVISION_AGENTFS_ENABLED === 'true',
      beadsEnabled: process.env.INTENTVISION_BEADS_ENABLED === 'true',
    },
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate that required configuration is present for staging/production
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const config = getAppConfig();
  const errors: string[] = [];

  // For staging and production, project ID is required
  if ((config.environment.isStaging || config.environment.isProduction) &&
      !config.firestore.projectId) {
    errors.push('INTENTVISION_FIRESTORE_PROJECT_ID is required for staging/production');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Log current configuration (for debugging/startup)
 */
export function logConfig(): void {
  const config = getAppConfig();

  console.log('[Config] Environment Configuration:');
  console.log(`  NODE_ENV: ${config.environment.nodeEnv}`);
  console.log(`  INTENTVISION_ENV: ${config.environment.env}`);
  console.log(`  Port: ${config.environment.port}`);
  console.log('[Config] Firestore Configuration:');
  console.log(`  Project ID: ${config.firestore.projectId || 'NOT SET'}`);
  console.log(`  Database: ${config.firestore.databaseId}`);
  console.log(`  Collection Prefix: ${config.firestore.collectionPrefix}`);
  console.log(`  Environment: ${config.firestore.environment}`);
  console.log('[Config] Features:');
  console.log(`  AgentFS: ${config.features.agentFsEnabled ? 'enabled' : 'disabled'}`);
  console.log(`  Beads: ${config.features.beadsEnabled ? 'enabled' : 'disabled'}`);
}

// =============================================================================
// Exports
// =============================================================================

export default {
  getNodeEnv,
  getIntentVisionEnv,
  getEnvironmentConfig,
  getFirestoreEnvConfig,
  getAppConfig,
  validateConfig,
  logConfig,
};
