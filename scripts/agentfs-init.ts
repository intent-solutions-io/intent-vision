#!/usr/bin/env npx tsx
/**
 * AgentFS Initialization Script
 *
 * Initializes the AgentFS database for IntentVision agent sessions.
 * Per AGENTS.md protocol, this ensures proper state tracking.
 */

import { AgentFS } from 'agentfs-sdk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

async function initAgentFS() {
  console.log('🤖 Initializing AgentFS for IntentVision...\n');

  // Initialize AgentFS with persistent storage
  const agent = await AgentFS.open({ id: 'intentvision' });
  console.log('✅ AgentFS database created: .agentfs/intentvision.db\n');

  // Store initial project context in KV store
  await agent.kv.set('project:name', 'IntentVision');
  await agent.kv.set('project:version', '1.0.0');
  await agent.kv.set('project:description', 'Universal Prediction Engine');

  // Store phase status
  await agent.kv.set('phase:a', { status: 'completed', name: 'Stack Alignment' });
  await agent.kv.set('phase:b', { status: 'completed', name: 'Nixtla TimeGPT' });
  await agent.kv.set('phase:c', { status: 'open', name: 'User Authentication' });
  await agent.kv.set('phase:d', { status: 'open', name: 'External Connections' });
  await agent.kv.set('phase:e', { status: 'open', name: 'Integration Testing' });
  await agent.kv.set('phase:f', { status: 'in_progress', name: 'Cloud Deployment' });

  console.log('📦 Stored project context in KV store');

  // Record this initialization as a tool call
  const startTime = Date.now() / 1000;
  await agent.tools.record(
    'agentfs_init',
    startTime,
    Date.now() / 1000,
    { project: 'intentvision' },
    { status: 'initialized' }
  );

  console.log('📝 Recorded initialization in tool call audit trail\n');

  // Create session snapshot
  const sessionSnapshot = {
    snapshot_id: `${new Date().toISOString().split('T')[0]}-phase-f-deployment`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project: 'intentvision',
    phase: 'F',
    status: {
      phase_a: 'completed',
      phase_b: 'completed',
      phase_c: 'open',
      phase_d: 'open',
      phase_e: 'open',
      phase_f: 'in_progress'
    },
    beads_tasks: {
      current: 'intentvision-xyq',
      completed: [
        'intentvision-5ba',
        'intentvision-jet',
        'intentvision-jet.1',
        'intentvision-jet.2',
        'intentvision-jet.3',
        'intentvision-jet.4'
      ]
    },
    tests: {
      total: 147,
      passing: true
    },
    agent: 'claude-opus-4.5'
  };

  // Store in KV store
  await agent.kv.set('session:current', sessionSnapshot);

  // Also update local snapshot
  const snapshotDir = join(process.cwd(), '.agentfs', 'snapshots');
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }

  writeFileSync(
    join(snapshotDir, `${sessionSnapshot.snapshot_id}.json`),
    JSON.stringify(sessionSnapshot, null, 2)
  );

  console.log('💾 Created session snapshot');
  console.log(`   KV: session:current`);
  console.log(`   Local: .agentfs/snapshots/${sessionSnapshot.snapshot_id}.json\n`);

  console.log('✅ AgentFS Setup Complete!');
  console.log('\n🚀 Ready for agent sessions!\n');
}

initAgentFS().catch(console.error);
