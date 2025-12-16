/**
 * Firestore Client
 *
 * Phase 1: Firestore-backed MVP Core
 * Beads Task: intentvision-002
 *
 * Initializes Firebase Admin SDK and provides Firestore access.
 * Supports both emulator (local dev) and production.
 */

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// =============================================================================
// Configuration
// =============================================================================

interface FirestoreConfig {
  projectId?: string;
  useEmulator?: boolean;
  emulatorHost?: string;
}

let _app: App | null = null;
let _db: Firestore | null = null;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize Firebase Admin and return Firestore instance.
 * Safe to call multiple times - returns existing instance.
 */
export function initFirestore(config: FirestoreConfig = {}): Firestore {
  if (_db) {
    return _db;
  }

  // Check if app already initialized
  if (getApps().length === 0) {
    const projectId = config.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'intentvision-dev';

    // Check for emulator
    const useEmulator = config.useEmulator || !!process.env.FIRESTORE_EMULATOR_HOST;

    if (useEmulator) {
      // Initialize without credentials for emulator
      console.log(`[Firestore] Using emulator at ${process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081'}`);
      _app = initializeApp({ projectId });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use service account credentials
      console.log('[Firestore] Using service account credentials');
      _app = initializeApp({
        credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        projectId,
      });
    } else {
      // Use default credentials (Cloud Run, GCE, etc.)
      console.log('[Firestore] Using default credentials');
      _app = initializeApp({ projectId });
    }
  } else {
    _app = getApps()[0];
  }

  _db = getFirestore(_app);

  // Configure settings
  _db.settings({
    ignoreUndefinedProperties: true,
  });

  return _db;
}

/**
 * Get Firestore instance (must call initFirestore first)
 */
export function getDb(): Firestore {
  if (!_db) {
    return initFirestore();
  }
  return _db;
}

/**
 * Reset Firestore client (for testing)
 */
export function resetFirestore(): void {
  _app = null;
  _db = null;
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
