/**
 * Webhook Ingestion Module
 *
 * Provides real-protocol ingestion path for metrics.
 *
 * Task IDs:
 * - intentvision-79x.1: Webhook endpoint
 * - intentvision-79x.2: Idempotency
 * - intentvision-79x.3: Schema validation
 * - intentvision-79x.4: Dead letter queue
 */

export * from './types.js';
export * from './validator.js';
export * from './idempotency.js';
export * from './dead-letter.js';
export * from './handler.js';
