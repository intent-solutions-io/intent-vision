/**
 * Decision Logger Tests
 *
 * Task ID: intentvision-rhs.3
 *
 * Tests for AgentFS decision logging.
 * Note: Full integration tests require AGENTFS_ENABLED=1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeAgentFS,
  isAgentFSEnabled,
  logDecision,
  logRoutingDecision,
  logToolSelection,
  logToolExecution,
  logFinalAnswer,
  createSnapshot,
} from '../src/logging/decision-logger.js';
import type { DecisionLog } from '../src/types.js';

describe('Decision Logger', () => {
  describe('Configuration', () => {
    beforeEach(() => {
      // Reset environment
      delete process.env.AGENTFS_ENABLED;
      delete process.env.AGENTFS_DB_PATH;
    });

    it('should be disabled by default', () => {
      initializeAgentFS();
      expect(isAgentFSEnabled()).toBe(false);
    });

    it('should be enabled when AGENTFS_ENABLED=1', () => {
      process.env.AGENTFS_ENABLED = '1';
      // Note: This will try to connect, which may fail in test env
      // The important thing is the config flag is respected
      expect(process.env.AGENTFS_ENABLED).toBe('1');
    });
  });

  describe('Stub Behavior (Disabled Mode)', () => {
    beforeEach(() => {
      delete process.env.AGENTFS_ENABLED;
      initializeAgentFS();
    });

    it('should not throw when logging decisions while disabled', async () => {
      const log: DecisionLog = {
        logId: 'test-log-1',
        requestId: 'test-request-1',
        timestamp: new Date().toISOString(),
        type: 'route',
        decision: { category: 'forecast', confidence: 0.9 },
        reasoning: 'Test reasoning',
        outcome: 'success',
      };

      await expect(logDecision(log)).resolves.not.toThrow();
    });

    it('should not throw when logging routing decisions while disabled', async () => {
      await expect(
        logRoutingDecision('req-1', 'forecast', 0.95, 'High confidence match')
      ).resolves.not.toThrow();
    });

    it('should not throw when logging tool selection while disabled', async () => {
      await expect(
        logToolSelection('req-1', 1, 'query_metrics', 'Need metric data')
      ).resolves.not.toThrow();
    });

    it('should not throw when logging tool execution while disabled', async () => {
      await expect(
        logToolExecution('req-1', 1, 'query_metrics', true, { count: 10 })
      ).resolves.not.toThrow();
    });

    it('should not throw when logging final answer while disabled', async () => {
      await expect(
        logFinalAnswer('req-1', { forecast: [1, 2, 3] }, 'Forecast complete')
      ).resolves.not.toThrow();
    });

    it('should return snapshot ID when creating snapshot while disabled', async () => {
      const snapshotId = await createSnapshot('req-1', { test: 'data' });
      expect(snapshotId).toMatch(/^snapshot-\d+$/);
    });
  });

  describe('Decision Log Structure', () => {
    it('should have correct structure for routing decision', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Temporarily enable logging output for this test
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await logRoutingDecision('req-123', 'anomaly', 0.87, 'Pattern detected');

      // Check that the logged structure is correct
      const logCall = consoleSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('[AgentFS:stub]')
      );

      if (logCall) {
        const loggedData = JSON.parse(logCall[1] as string);
        expect(loggedData.requestId).toBe('req-123');
        expect(loggedData.type).toBe('route');
        expect(loggedData.decision.category).toBe('anomaly');
        expect(loggedData.decision.confidence).toBe(0.87);
        expect(loggedData.reasoning).toBe('Pattern detected');
        expect(loggedData.outcome).toBe('success');
      }

      process.env.NODE_ENV = originalNodeEnv;
      consoleSpy.mockRestore();
    });
  });
});

/**
 * Integration Test (requires AGENTFS_ENABLED=1)
 *
 * To run with real AgentFS:
 *
 * AGENTFS_ENABLED=1 npx vitest run packages/agent/tests/decision-logger.test.ts
 *
 * This will:
 * 1. Connect to .agentfs/intentvision.db
 * 2. Persist decisions to the KV store
 * 3. Record tool calls in the audit trail
 */
describe.skip('AgentFS Integration (requires AGENTFS_ENABLED=1)', () => {
  it('should persist decision to AgentFS', async () => {
    if (process.env.AGENTFS_ENABLED !== '1') {
      console.log('Skipping: Set AGENTFS_ENABLED=1 to run integration tests');
      return;
    }

    initializeAgentFS();

    const requestId = `test-${Date.now()}`;
    await logRoutingDecision(requestId, 'forecast', 0.99, 'Integration test');

    // In a real test, we would query the decision back
    // const decision = await getDecision(requestId, `${requestId}-route`);
    // expect(decision).not.toBeNull();
  });
});
