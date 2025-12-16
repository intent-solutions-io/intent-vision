/**
 * Health Endpoint Tests
 *
 * Task ID: intentvision-rhs.4
 *
 * Unit tests for health check endpoints.
 * Tests response structure without requiring external dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerResponse } from 'http';
import {
  handleBasicHealth,
  handleLiveness,
  matchHealthRoute,
  BasicHealthResponse,
  LivenessResponse,
} from '../routes/health.js';

// Mock ServerResponse
function createMockResponse(): {
  res: ServerResponse;
  getResponse: () => { statusCode: number; headers: Record<string, string>; body: string };
} {
  let statusCode = 200;
  let headers: Record<string, string> = {};
  let body = '';

  const res = {
    writeHead: vi.fn((code: number, hdrs?: Record<string, string>) => {
      statusCode = code;
      if (hdrs) headers = hdrs;
    }),
    end: vi.fn((data?: string) => {
      if (data) body = data;
    }),
  } as unknown as ServerResponse;

  return {
    res,
    getResponse: () => ({ statusCode, headers, body }),
  };
}

describe('Health Endpoints', () => {
  describe('GET /health - Basic Health', () => {
    it('should return 200 with healthy status', async () => {
      const { res, getResponse } = createMockResponse();

      await handleBasicHealth(res);

      const { statusCode, headers, body } = getResponse();
      expect(statusCode).toBe(200);
      expect(headers['Content-Type']).toBe('application/json');

      const response: BasicHealthResponse = JSON.parse(body);
      expect(response.status).toBe('healthy');
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should have valid ISO timestamp', async () => {
      const { res, getResponse } = createMockResponse();

      await handleBasicHealth(res);

      const { body } = getResponse();
      const response: BasicHealthResponse = JSON.parse(body);

      // Verify timestamp is valid ISO 8601
      const timestamp = new Date(response.timestamp);
      expect(timestamp.toISOString()).toBe(response.timestamp);
    });
  });

  describe('GET /health/live - Liveness Probe', () => {
    it('should return 200 with alive status', async () => {
      const { res, getResponse } = createMockResponse();

      await handleLiveness(res);

      const { statusCode, headers, body } = getResponse();
      expect(statusCode).toBe(200);
      expect(headers['Content-Type']).toBe('application/json');

      const response: LivenessResponse = JSON.parse(body);
      expect(response.status).toBe('alive');
      expect(response.timestamp).toBeDefined();
    });

    it('should always succeed (no external dependencies)', async () => {
      // Liveness should never fail - it's a simple ping
      const { res, getResponse } = createMockResponse();

      await handleLiveness(res);

      const { statusCode } = getResponse();
      expect(statusCode).toBe(200);
    });
  });

  describe('Route Matching', () => {
    it('should match /health route', () => {
      const handler = matchHealthRoute('/health', 'GET');
      expect(handler).toBe(handleBasicHealth);
    });

    it('should match /health/live route', () => {
      const handler = matchHealthRoute('/health/live', 'GET');
      expect(handler).toBe(handleLiveness);
    });

    it('should match /health/ready route', () => {
      const handler = matchHealthRoute('/health/ready', 'GET');
      expect(handler).not.toBeNull();
    });

    it('should match /health/detailed route', () => {
      const handler = matchHealthRoute('/health/detailed', 'GET');
      expect(handler).not.toBeNull();
    });

    it('should return null for unknown paths', () => {
      const handler = matchHealthRoute('/health/unknown', 'GET');
      expect(handler).toBeNull();
    });

    it('should return null for non-GET methods', () => {
      const handler = matchHealthRoute('/health', 'POST');
      expect(handler).toBeNull();
    });

    it('should return null for DELETE method', () => {
      const handler = matchHealthRoute('/health', 'DELETE');
      expect(handler).toBeNull();
    });
  });

  describe('Response Types', () => {
    it('BasicHealthResponse should have required fields', async () => {
      const { res, getResponse } = createMockResponse();

      await handleBasicHealth(res);

      const { body } = getResponse();
      const response = JSON.parse(body);

      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(['healthy', 'unhealthy']).toContain(response.status);
    });

    it('LivenessResponse should have required fields', async () => {
      const { res, getResponse } = createMockResponse();

      await handleLiveness(res);

      const { body } = getResponse();
      const response = JSON.parse(body);

      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(response.status).toBe('alive');
    });
  });
});

/**
 * Integration tests for /health/ready and /health/detailed
 * require Firestore connection and are tested separately
 * in the E2E test suite or with mocked Firestore.
 */
describe.skip('Health Endpoints (Integration - requires Firestore)', () => {
  it('GET /health/ready should check Firestore connection', async () => {
    // This test requires Firestore emulator or real connection
    // Run with: npm run test:integration --workspace=@intentvision/api
  });

  it('GET /health/detailed should return metrics', async () => {
    // This test requires metrics to be collected
    // Run with: npm run test:integration --workspace=@intentvision/api
  });
});
