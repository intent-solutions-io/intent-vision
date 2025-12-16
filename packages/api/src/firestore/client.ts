/**
 * Firestore Client Factory
 *
 * Phase 1: Firestore-backed MVP Core
 * Phase 7: Cloud Firestore Wiring + Live Tests
 * Phase 9: Staging Cloud Run + Firestore + Cloud Smoke Tests
 * Beads Tasks: intentvision-002, intentvision-olu, intentvision-vf7
 *
 * Initializes Firebase Admin SDK and provides Firestore access.
 * Supports both real GCP Firestore (default) and emulator (opt-in).
 *
 * Configuration via environment variables:
 * - INTENTVISION_GCP_PROJECT_ID: GCP project ID (required for cloud)
 * - INTENTVISION_FIRESTORE_PROJECT_ID: Alias for GCP project (preferred)
 * - INTENTVISION_FIRESTORE_DB: Firestore database name (default: "(default)")
 * - INTENTVISION_ENV: Environment prefix for collection isolation (local/dev/staging/prod)
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON (local dev)
 * - FIRESTORE_EMULATOR_HOST: Emulator host (optional, enables emulator mode)
 */

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// =============================================================================
// Configuration
// =============================================================================

export interface FirestoreConfig {
  /** GCP Project ID */
  projectId?: string;
  /** Firestore database name (default: "(default)") */
  databaseId?: string;
  /** Environment for collection prefixing (dev/stage/prod) */
  environment?: string;
  /** Force emulator mode (only if FIRESTORE_EMULATOR_HOST is set) */
  useEmulator?: boolean;
}

interface FirestoreClientState {
  app: App | null;
  db: Firestore | null;
  config: FirestoreConfig;
}

const state: FirestoreClientState = {
  app: null,
  db: null,
  config: {},
};

// =============================================================================
// Environment Configuration
// =============================================================================

/**
 * Get configuration from environment variables
 */
export function getFirestoreConfig(): FirestoreConfig {
  return {
    projectId: process.env.INTENTVISION_FIRESTORE_PROJECT_ID ||
               process.env.INTENTVISION_GCP_PROJECT_ID ||
               process.env.GOOGLE_CLOUD_PROJECT,
    databaseId: process.env.INTENTVISION_FIRESTORE_DB || '(default)',
    environment: process.env.INTENTVISION_ENV || 'dev',
    useEmulator: !!process.env.FIRESTORE_EMULATOR_HOST,
  };
}

/**
 * Check if using emulator mode
 */
export function isEmulatorMode(): boolean {
  return !!process.env.FIRESTORE_EMULATOR_HOST;
}

/**
 * Check if cloud Firestore is properly configured
 */
export function isCloudConfigured(): boolean {
  const config = getFirestoreConfig();
  return !!(config.projectId && !isEmulatorMode());
}

// =============================================================================
// Client Initialization
// =============================================================================

/**
 * Initialize Firebase Admin and return Firestore instance.
 * Safe to call multiple times - returns existing instance.
 *
 * Priority:
 * 1. If FIRESTORE_EMULATOR_HOST is set, use emulator (no credentials needed)
 * 2. If GOOGLE_APPLICATION_CREDENTIALS is set, use service account
 * 3. Otherwise, use Application Default Credentials (ADC)
 */
export function initFirestore(config: FirestoreConfig = {}): Firestore {
  if (state.db) {
    return state.db;
  }

  const envConfig = getFirestoreConfig();
  const finalConfig: FirestoreConfig = {
    ...envConfig,
    ...config,
  };

  state.config = finalConfig;

  // Validate configuration for cloud mode
  if (!finalConfig.useEmulator && !finalConfig.projectId) {
    console.warn('[Firestore] WARNING: No project ID configured and not using emulator.');
    console.warn('[Firestore] Set INTENTVISION_GCP_PROJECT_ID or FIRESTORE_EMULATOR_HOST');
  }

  // Check if app already initialized
  if (getApps().length === 0) {
    const projectId = finalConfig.projectId || 'intentvision-local';

    if (finalConfig.useEmulator) {
      // Emulator mode - no credentials needed
      console.log(`[Firestore] Using emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
      state.app = initializeApp({ projectId });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Service account credentials (local dev with cloud Firestore)
      console.log(`[Firestore] Cloud mode with service account`);
      console.log(`[Firestore] Project: ${projectId}`);
      console.log(`[Firestore] Environment: ${finalConfig.environment}`);
      state.app = initializeApp({
        credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        projectId,
      });
    } else {
      // Application Default Credentials (Cloud Run, GCE, GitHub Actions with WIF)
      console.log(`[Firestore] Cloud mode with ADC`);
      console.log(`[Firestore] Project: ${projectId}`);
      console.log(`[Firestore] Environment: ${finalConfig.environment}`);
      state.app = initializeApp({ projectId });
    }
  } else {
    state.app = getApps()[0];
  }

  // Get Firestore instance (supports named databases if needed)
  state.db = getFirestore(state.app);

  // Configure settings
  state.db.settings({
    ignoreUndefinedProperties: true,
  });

  return state.db;
}

/**
 * Get Firestore instance (initializes if needed)
 */
export function getDb(): Firestore {
  if (!state.db) {
    return initFirestore();
  }
  return state.db;
}

/**
 * Get the current environment prefix
 */
export function getEnvironment(): string {
  return state.config.environment || process.env.INTENTVISION_ENV || 'dev';
}

/**
 * Get an environment-prefixed collection path
 * Example: getEnvCollection('orgs') returns 'envs/dev/orgs' in dev mode
 *
 * @param basePath - The base collection path (e.g., 'orgs' or 'orgs/{orgId}/metrics')
 * @param useEnvPrefix - Whether to add environment prefix (default: true)
 */
export function getEnvCollection(basePath: string, useEnvPrefix: boolean = true): string {
  if (!useEnvPrefix) {
    return basePath;
  }
  const env = getEnvironment();
  return `envs/${env}/${basePath}`;
}

/**
 * Reset Firestore client (for testing)
 */
export function resetFirestore(): void {
  state.app = null;
  state.db = null;
  state.config = {};
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert Firestore Timestamp to Date
 */
export function toDate(timestamp: FirebaseFirestore.Timestamp | Date | undefined): Date | undefined {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
}

/**
 * Convert Date to Firestore Timestamp-compatible object
 */
export function toTimestamp(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Generate a random document ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

// =============================================================================
// Diagnostic Functions
// =============================================================================

/**
 * Get current Firestore configuration (for diagnostics)
 */
export function getClientInfo(): {
  mode: 'emulator' | 'cloud';
  projectId: string | undefined;
  environment: string;
  databaseId: string;
  initialized: boolean;
} {
  const config = state.config.projectId ? state.config : getFirestoreConfig();
  return {
    mode: isEmulatorMode() ? 'emulator' : 'cloud',
    projectId: config.projectId,
    environment: config.environment || 'dev',
    databaseId: config.databaseId || '(default)',
    initialized: !!state.db,
  };
}
