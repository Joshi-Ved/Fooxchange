/**
 * Request ID Middleware
 *
 * Generates unique request IDs for tracking requests end-to-end.
 * Useful for debugging, logging, and correlating errors.
 *
 * Usage in API route:
 * ```ts
 * const requestId = getRequestId(request);
 * console.log(`[${requestId}] Processing request...`);
 * ```
 */

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Generates a unique request ID (UUID v4)
 */
export function generateRequestId(): string {
    // Use crypto.randomUUID() if available (Node 19+, all modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback: Generate UUID v4 manually
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * UUID v4 format regex for request ID validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Gets or creates a request ID from headers
 * If client provides a valid UUID x-request-id, reuse it (for request tracing)
 * Otherwise generate a new one. Validates format to prevent log-forging (MED-33).
 */
export function getRequestId(request: Request): string {
    // Check if client sent a valid request ID
    const existingId = request.headers.get(REQUEST_ID_HEADER);
    if (existingId && UUID_REGEX.test(existingId)) {
        return existingId;
    }

    // Generate new ID
    return generateRequestId();
}

/**
 * Creates response headers with request ID
 * Include this in all API responses for request correlation
 */
export function createRequestIdHeaders(requestId: string): Record<string, string> {
    return {
        [REQUEST_ID_HEADER]: requestId,
    };
}

/**
 * Middleware wrapper for API routes
 * Automatically adds request ID to all responses
 *
 * @example
 * export async function GET(req: Request) {
 *     return withRequestId(req, async (requestId) => {
 *         console.log(`[${requestId}] Fetching data...`);
 *         const data = await fetchData();
 *         return Response.json(data);
 *     });
 * }
 */
export async function withRequestId<T extends Response>(
    request: Request,
    handler: (requestId: string) => Promise<T>
): Promise<T> {
    const requestId = getRequestId(request);

    try {
        const response = await handler(requestId);

        // Add request ID to response headers
        response.headers.set(REQUEST_ID_HEADER, requestId);

        return response;
    } catch (error) {
        console.error(`[${requestId}] Request failed:`, error);
        throw error;
    }
}

/**
 * Context-aware logger that includes request ID
 */
export class RequestLogger {
    constructor(private requestId: string) {}

    log(...args: any[]) {
        console.log(`[${this.requestId}]`, ...args);
    }

    error(...args: any[]) {
        console.error(`[${this.requestId}]`, ...args);
    }

    warn(...args: any[]) {
        console.warn(`[${this.requestId}]`, ...args);
    }

    info(...args: any[]) {
        console.info(`[${this.requestId}]`, ...args);
    }

    debug(...args: any[]) {
        console.debug(`[${this.requestId}]`, ...args);
    }
}

/**
 * Creates a logger instance with request ID context
 */
export function createLogger(request: Request): RequestLogger {
    const requestId = getRequestId(request);
    return new RequestLogger(requestId);
}
