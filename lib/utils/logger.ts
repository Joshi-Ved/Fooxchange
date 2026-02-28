/**
 * Structured Logger  (lib/utils/logger.ts)
 *
 * Produces JSON-structured log lines in production/CI and human-readable
 * console output in development.
 *
 * Designed for:
 *   - Easy ingestion by Datadog, Logtail, or any JSON log aggregator
 *   - Separate AI failure tracking (level: 'ai-error')
 *   - Zero external dependencies
 *
 * Usage:
 *   import { logger } from '@/lib/utils/logger';
 *   logger.info('User signed in', { userId });
 *   logger.aiError('Embedding failed', { route: '/api/ai/recommend', err });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'ai-error';

type LogContext = Record<string, unknown>;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  env: string;
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

/** Serialise an unknown error to a plain object for JSON output. */
function serialiseError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: IS_PROD ? undefined : err.stack };
  }
  return { raw: String(err) };
}

function buildEntry(level: LogLevel, message: string, ctx?: LogContext): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'unknown',
  };

  if (ctx) {
    for (const [k, v] of Object.entries(ctx)) {
      // Serialise Error objects so they survive JSON.stringify
      entry[k] = v instanceof Error ? serialiseError(v) : v;
    }
  }

  return entry;
}

function emit(level: LogLevel, message: string, ctx?: LogContext) {
  if (IS_TEST) return; // silence during unit tests unless explicitly enabled

  const entry = buildEntry(level, message, ctx);

  if (IS_PROD) {
    // Structured JSON — one line per event for log aggregators
    const output = JSON.stringify(entry);
    if (level === 'error' || level === 'ai-error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  } else {
    // Human-readable in development
    const prefix: Record<LogLevel, string> = {
      debug: '🔍 DEBUG',
      info: '💡 INFO ',
      warn: '⚠️  WARN ',
      error: '🔴 ERROR',
      'ai-error': '🤖 AI ER',
    };
    const contextStr = ctx ? ' ' + JSON.stringify(ctx, null, 0) : '';
    const consoleFn =
      level === 'error' || level === 'ai-error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.log;
    consoleFn(`[${entry.timestamp}] ${prefix[level]} ${message}${contextStr}`);
  }
}

export const logger = {
  debug: (message: string, ctx?: LogContext) => emit('debug', message, ctx),
  info: (message: string, ctx?: LogContext) => emit('info', message, ctx),
  warn: (message: string, ctx?: LogContext) => emit('warn', message, ctx),
  error: (message: string, ctx?: LogContext) => emit('error', message, ctx),

  /**
   * Log AI-specific failures to a separate channel so they can be
   * filtered / alerted on independently of generic application errors.
   */
  aiError: (message: string, ctx?: LogContext) => emit('ai-error', message, ctx),
} as const;
