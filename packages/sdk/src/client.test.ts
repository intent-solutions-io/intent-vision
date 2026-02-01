/**
 * IntentVision SDK Client Tests
 *
 * Phase 19: Developer Experience - OpenAPI, SDK, and Sandbox Keys
 */

import { describe, it, expect } from 'vitest';
import { IntentVisionClient } from './client.js';
import { IntentVisionError } from './types.js';

describe('IntentVisionClient', () => {
  describe('constructor', () => {
    it('should require an API key', () => {
      expect(() => {
        // @ts-expect-error - Testing missing API key
        new IntentVisionClient({});
      }).toThrow('API key is required');
    });

    it('should validate API key format', () => {
      expect(() => {
        new IntentVisionClient({ apiKey: 'invalid_key' });
      }).toThrow('Invalid API key format');
    });

    it('should accept valid API key', () => {
      const client = new IntentVisionClient({
        apiKey: 'iv_test_key_12345',
      });
      expect(client).toBeInstanceOf(IntentVisionClient);
    });

    it('should use default base URL', () => {
      const client = new IntentVisionClient({
        apiKey: 'iv_test_key_12345',
      });
      expect(client).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const client = new IntentVisionClient({
        apiKey: 'iv_test_key_12345',
        baseUrl: 'http://localhost:3000',
      });
      expect(client).toBeDefined();
    });
  });

  describe('IntentVisionError', () => {
    it('should create error with all fields', () => {
      const error = new IntentVisionError(
        'Test error',
        'TEST_CODE',
        400,
        { detail: 'test' },
        'req_123'
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.requestId).toBe('req_123');
      expect(error.name).toBe('IntentVisionError');
    });

    it('should be instanceof Error', () => {
      const error = new IntentVisionError('Test', 'CODE', 400);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(IntentVisionError);
    });
  });
});
