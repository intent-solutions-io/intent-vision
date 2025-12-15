/**
 * GCS Storage Configuration and Operations
 *
 * Task ID: intentvision-msy.3
 *
 * Bucket naming follows GCP conventions (no numbers, lowercase):
 * - intentvision-fixtures: Fixture data for pipeline tests
 * - intentvision-exports: Pipeline output exports
 */

import { Storage } from '@google-cloud/storage';

// =============================================================================
// Configuration
// =============================================================================

export interface StorageConfig {
  projectId: string;
  region: string;
  buckets: {
    fixtures: string;
    exports: string;
  };
}

/**
 * Get storage configuration from environment
 */
export function getStorageConfig(): StorageConfig {
  const projectId = process.env.GCP_PROJECT_ID || 'intentvision-dev';
  const region = process.env.GCP_REGION || 'us-central1';

  return {
    projectId,
    region,
    buckets: {
      fixtures: `${projectId}-fixtures`,
      exports: `${projectId}-exports`,
    },
  };
}

// =============================================================================
// Storage Client
// =============================================================================

let _storage: Storage | null = null;

/**
 * Get or create Storage client
 */
export function getStorage(): Storage {
  if (!_storage) {
    const config = getStorageConfig();
    _storage = new Storage({
      projectId: config.projectId,
    });
  }
  return _storage;
}

// =============================================================================
// Bucket Operations
// =============================================================================

/**
 * Check if bucket exists
 */
export async function bucketExists(bucketName: string): Promise<boolean> {
  try {
    const storage = getStorage();
    const [exists] = await storage.bucket(bucketName).exists();
    return exists;
  } catch {
    return false;
  }
}

/**
 * Create bucket if it doesn't exist
 */
export async function ensureBucket(bucketName: string): Promise<void> {
  const storage = getStorage();
  const config = getStorageConfig();

  const exists = await bucketExists(bucketName);
  if (exists) {
    console.log(`Bucket ${bucketName} already exists`);
    return;
  }

  console.log(`Creating bucket ${bucketName} in ${config.region}`);
  await storage.createBucket(bucketName, {
    location: config.region,
    storageClass: 'STANDARD',
  });
}

// =============================================================================
// Fixture Operations
// =============================================================================

/**
 * Upload fixture file to GCS
 */
export async function uploadFixture(
  filename: string,
  content: string | Buffer
): Promise<string> {
  const config = getStorageConfig();
  const storage = getStorage();

  const bucket = storage.bucket(config.buckets.fixtures);
  const file = bucket.file(`fixtures/${filename}`);

  await file.save(content, {
    contentType: 'application/json',
    metadata: {
      uploadedAt: new Date().toISOString(),
    },
  });

  return `gs://${config.buckets.fixtures}/fixtures/${filename}`;
}

/**
 * Download fixture file from GCS
 */
export async function downloadFixture(filename: string): Promise<string> {
  const config = getStorageConfig();
  const storage = getStorage();

  const bucket = storage.bucket(config.buckets.fixtures);
  const file = bucket.file(`fixtures/${filename}`);

  const [content] = await file.download();
  return content.toString('utf-8');
}

/**
 * List available fixtures
 */
export async function listFixtures(): Promise<string[]> {
  const config = getStorageConfig();
  const storage = getStorage();

  const bucket = storage.bucket(config.buckets.fixtures);
  const [files] = await bucket.getFiles({ prefix: 'fixtures/' });

  return files.map((f) => f.name.replace('fixtures/', ''));
}

// =============================================================================
// Export Operations
// =============================================================================

/**
 * Upload pipeline export to GCS
 */
export async function uploadExport(
  orgId: string,
  exportType: 'metrics' | 'forecasts' | 'alerts',
  content: string | Buffer
): Promise<string> {
  const config = getStorageConfig();
  const storage = getStorage();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${orgId}/${exportType}/${timestamp}.json`;

  const bucket = storage.bucket(config.buckets.exports);
  const file = bucket.file(filename);

  await file.save(content, {
    contentType: 'application/json',
    metadata: {
      orgId,
      exportType,
      exportedAt: new Date().toISOString(),
    },
  });

  return `gs://${config.buckets.exports}/${filename}`;
}
