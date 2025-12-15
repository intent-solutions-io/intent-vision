/**
 * Observability - Structured logging and correlation IDs
 *
 * Task ID: intentvision-8vu
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  taskId?: string;
  component?: string;
  orgId?: string;
  metricKey?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: unknown;
}

// =============================================================================
// Logger
// =============================================================================

class Logger {
  private defaultContext: LogContext = {};

  /**
   * Set default context for all log entries
   */
  setDefaultContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const child = new Logger();
    child.defaultContext = { ...this.defaultContext, ...context };
    return child;
  }

  /**
   * Log at debug level
   */
  debug(message: string, data?: unknown, context?: LogContext): void {
    this.log('debug', message, data, context);
  }

  /**
   * Log at info level
   */
  info(message: string, data?: unknown, context?: LogContext): void {
    this.log('info', message, data, context);
  }

  /**
   * Log at warn level
   */
  warn(message: string, data?: unknown, context?: LogContext): void {
    this.log('warn', message, data, context);
  }

  /**
   * Log at error level
   */
  error(message: string, data?: unknown, context?: LogContext): void {
    this.log('error', message, data, context);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    context?: LogContext
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
      data,
    };

    // Format based on level
    const output = this.format(entry);

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  /**
   * Format log entry for output
   */
  private format(entry: LogEntry): string {
    const { timestamp, level, message, context, data } = entry;
    const levelUpper = level.toUpperCase().padEnd(5);

    // Build context string
    const contextParts: string[] = [];
    if (context.correlationId) {
      contextParts.push(`cid=${context.correlationId.slice(0, 8)}`);
    }
    if (context.taskId) {
      contextParts.push(`task=${context.taskId}`);
    }
    if (context.component) {
      contextParts.push(`comp=${context.component}`);
    }
    if (context.orgId) {
      contextParts.push(`org=${context.orgId}`);
    }

    const contextStr = contextParts.length > 0 ? ` [${contextParts.join(' ')}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';

    return `${timestamp} ${levelUpper}${contextStr} ${message}${dataStr}`;
  }
}

// =============================================================================
// Correlation ID Management
// =============================================================================

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Create execution context with correlation ID
 */
export function createExecutionContext(options?: {
  correlationId?: string;
  taskId?: string;
  component?: string;
}): LogContext {
  return {
    correlationId: options?.correlationId || generateCorrelationId(),
    taskId: options?.taskId,
    component: options?.component,
  };
}

// =============================================================================
// Pipeline Metrics
// =============================================================================

export interface PipelineMetrics {
  startTime: number;
  endTime?: number;
  metricsProcessed: number;
  metricsStored: number;
  forecastsGenerated: number;
  anomaliesDetected: number;
  alertsEmitted: number;
  errors: number;
}

/**
 * Create a new pipeline metrics tracker
 */
export function createPipelineMetrics(): PipelineMetrics {
  return {
    startTime: Date.now(),
    metricsProcessed: 0,
    metricsStored: 0,
    forecastsGenerated: 0,
    anomaliesDetected: 0,
    alertsEmitted: 0,
    errors: 0,
  };
}

/**
 * Finalize and log pipeline metrics
 */
export function finalizePipelineMetrics(
  metrics: PipelineMetrics,
  logger: Logger
): PipelineMetrics {
  metrics.endTime = Date.now();
  const durationMs = metrics.endTime - metrics.startTime;

  logger.info('Pipeline execution completed', {
    durationMs,
    metricsProcessed: metrics.metricsProcessed,
    metricsStored: metrics.metricsStored,
    forecastsGenerated: metrics.forecastsGenerated,
    anomaliesDetected: metrics.anomaliesDetected,
    alertsEmitted: metrics.alertsEmitted,
    errors: metrics.errors,
    throughput: metrics.metricsProcessed / (durationMs / 1000),
  });

  return metrics;
}

// =============================================================================
// Exports
// =============================================================================

export const logger = new Logger();
export { Logger };
