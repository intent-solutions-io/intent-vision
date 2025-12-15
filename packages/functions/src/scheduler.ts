/**
 * Cloud Tasks Scheduler Stub
 *
 * Task ID: intentvision-msy.4
 *
 * Provides scheduling capabilities for pipeline runs:
 * - One-off task creation
 * - Scheduled recurring runs
 * - Task queue management
 */

import { CloudTasksClient } from '@google-cloud/tasks';

// =============================================================================
// Configuration
// =============================================================================

export interface SchedulerConfig {
  projectId: string;
  region: string;
  queueName: string;
  functionUrl: string;
}

/**
 * Get scheduler configuration from environment
 */
export function getSchedulerConfig(): SchedulerConfig {
  return {
    projectId: process.env.GCP_PROJECT_ID || 'intentvision-dev',
    region: process.env.GCP_REGION || 'us-central1',
    queueName: process.env.TASK_QUEUE_NAME || 'intentvision-pipeline',
    functionUrl:
      process.env.PIPELINE_FUNCTION_URL ||
      'https://us-central1-intentvision-dev.cloudfunctions.net/runPipeline',
  };
}

// =============================================================================
// Client
// =============================================================================

let _client: CloudTasksClient | null = null;

/**
 * Get or create Cloud Tasks client
 */
export function getTasksClient(): CloudTasksClient {
  if (!_client) {
    _client = new CloudTasksClient();
  }
  return _client;
}

// =============================================================================
// Task Creation
// =============================================================================

export interface PipelineTaskPayload {
  orgId: string;
  useSynthetic?: boolean;
  forecastHorizon?: number;
  forecastThreshold?: number;
  anomalySensitivity?: number;
}

/**
 * Create a pipeline task to run immediately or at a scheduled time
 */
export async function createPipelineTask(
  payload: PipelineTaskPayload,
  scheduleTime?: Date
): Promise<string> {
  const client = getTasksClient();
  const config = getSchedulerConfig();

  const parent = client.queuePath(config.projectId, config.region, config.queueName);

  const task: {
    httpRequest: {
      httpMethod: 'POST';
      url: string;
      headers: Record<string, string>;
      body: string;
    };
    scheduleTime?: { seconds: number };
  } = {
    httpRequest: {
      httpMethod: 'POST',
      url: config.functionUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    },
  };

  // Add schedule time if provided
  if (scheduleTime) {
    task.scheduleTime = {
      seconds: Math.floor(scheduleTime.getTime() / 1000),
    };
  }

  const [response] = await client.createTask({
    parent,
    task,
  });

  console.log(`Created task: ${response.name}`);
  return response.name || '';
}

/**
 * Create multiple pipeline tasks for batch processing
 */
export async function createPipelineTaskBatch(
  payloads: PipelineTaskPayload[],
  intervalSeconds: number = 60
): Promise<string[]> {
  const taskNames: string[] = [];
  const now = Date.now();

  for (let i = 0; i < payloads.length; i++) {
    const scheduleTime = new Date(now + i * intervalSeconds * 1000);
    const taskName = await createPipelineTask(payloads[i], scheduleTime);
    taskNames.push(taskName);
  }

  return taskNames;
}

// =============================================================================
// Queue Management
// =============================================================================

/**
 * Create the pipeline task queue if it doesn't exist
 */
export async function ensureTaskQueue(): Promise<void> {
  const client = getTasksClient();
  const config = getSchedulerConfig();

  const parent = client.locationPath(config.projectId, config.region);
  const queuePath = client.queuePath(config.projectId, config.region, config.queueName);

  try {
    await client.getQueue({ name: queuePath });
    console.log(`Queue ${config.queueName} already exists`);
  } catch (error) {
    const err = error as { code?: number };
    if (err.code === 5) {
      // NOT_FOUND
      console.log(`Creating queue ${config.queueName}`);
      await client.createQueue({
        parent,
        queue: {
          name: queuePath,
          rateLimits: {
            maxDispatchesPerSecond: 10,
            maxConcurrentDispatches: 5,
          },
          retryConfig: {
            maxAttempts: 3,
            minBackoff: { seconds: 10 },
            maxBackoff: { seconds: 600 },
          },
        },
      });
    } else {
      throw error;
    }
  }
}

/**
 * List pending tasks in the queue
 */
export async function listPendingTasks(): Promise<string[]> {
  const client = getTasksClient();
  const config = getSchedulerConfig();

  const parent = client.queuePath(config.projectId, config.region, config.queueName);

  const [tasks] = await client.listTasks({ parent });
  return tasks.map((t) => t.name || '').filter(Boolean);
}

/**
 * Purge all tasks from the queue
 */
export async function purgeTaskQueue(): Promise<void> {
  const client = getTasksClient();
  const config = getSchedulerConfig();

  const queuePath = client.queuePath(config.projectId, config.region, config.queueName);

  await client.purgeQueue({ name: queuePath });
  console.log(`Purged queue ${config.queueName}`);
}
