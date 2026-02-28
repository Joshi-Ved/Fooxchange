/**
 * Rate Limiting Middleware
 * Protects APIs from abuse and DoS attacks
 * 
 * Uses in-memory storage for simplicity. 
 * For production with multiple servers, use Redis (Upstash/Vercel KV)
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

/**
 * WARNING: In-memory store — NOT suitable for multi-instance production deployments.
 * For production with multiple servers/containers, replace with Redis (Upstash/Vercel KV).
 * This store is per-process and will reset on each deployment or restart.
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup expired entries lazily during rate-limit checks.
 * Avoids top-level setInterval which leaks timers during testing
 * and in serverless environments.
 */
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function cleanupExpired(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, value] of rateLimitStore.entries()) {
        if (value.resetAt < now) {
            rateLimitStore.delete(key);
        }
    }
}

export interface RateLimitConfig {
    /**
     * Maximum number of requests allowed in the time window
     */
    maxRequests: number;

    /**
     * Time window in seconds
     */
    windowSeconds: number;

    /**
     * Custom identifier (default: userId or IP)
     */
    identifier?: string;
}

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp when limit resets
}

/**
 * Rate limit checker
 * @param identifier - Unique identifier (userId, IP, API key, etc.)
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed
 */
export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    // Lazy cleanup of expired entries
    cleanupExpired();

    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    // Get or create entry
    let entry = rateLimitStore.get(identifier);

    // Reset if window expired
    if (!entry || entry.resetAt < now) {
        entry = {
            count: 0,
            resetAt: now + windowMs,
        };
        rateLimitStore.set(identifier, entry);
    }

    // Increment count
    entry.count++;

    const remaining = Math.max(0, config.maxRequests - entry.count);
    const success = entry.count <= config.maxRequests;

    return {
        success,
        limit: config.maxRequests,
        remaining,
        reset: Math.floor(entry.resetAt / 1000), // Convert to Unix timestamp
    };
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
    /**
     * Standard API endpoints (200 requests per minute)
     */
    standard: {
        maxRequests: 200,
        windowSeconds: 60,
    },

    /**
     * AI/ML endpoints - expensive operations (10 requests per minute)
     */
    ai: {
        maxRequests: 10,
        windowSeconds: 60,
    },

    /**
     * Vision API - very expensive (5 requests per minute)
     */
    vision: {
        maxRequests: 5,
        windowSeconds: 60,
    },

    /**
     * Authentication endpoints - prevent brute force (5 requests per 15 minutes)
     */
    auth: {
        maxRequests: 5,
        windowSeconds: 15 * 60,
    },

    /**
     * Strict - for sensitive operations (3 requests per hour)
     */
    strict: {
        maxRequests: 3,
        windowSeconds: 60 * 60,
    },
} as const;

/**
 * Helper to get client identifier with improved security
 * Prefers userId, falls back to validated IP address
 *
 * Security considerations:
 * - Only trust headers from known proxies/CDNs
 * - Validate IP format to prevent injection
 * - Use multiple headers for redundancy
 */
export function getClientIdentifier(request: Request, userId?: string | null): string {
    if (userId) {
        return `user:${userId}`;
    }

    // Try to get IP from various headers (proxies, CDN)
    // Priority: Cloudflare > X-Real-IP > X-Forwarded-For
    const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare (most trusted)
    const realIp = request.headers.get('x-real-ip');
    const forwarded = request.headers.get('x-forwarded-for');

    // Get the first IP from x-forwarded-for (client IP)
    const forwardedIp = forwarded?.split(',')[0]?.trim();

    // Prioritize trusted sources
    let rawIp = cfConnectingIp || realIp || forwardedIp || 'unknown';

    // Basic IP validation to prevent header injection
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // Accepts full, compressed (::1), and mixed IPv6 formats (MED-41)
    const ipv6Regex = /^([0-9a-f]{0,4}:){1,7}[0-9a-f]{0,4}$/i;

    if (rawIp !== 'unknown' && !ipv4Regex.test(rawIp) && !ipv6Regex.test(rawIp)) {
        console.warn(`[Security] Invalid IP format detected: ${rawIp}`);
        rawIp = 'unknown';
    }

    return `ip:${rawIp}`;
}

/**
 * Rate limit error response helper
 */
export function rateLimitExceededResponse(result: RateLimitResult) {
    return new Response(
        JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            limit: result.limit,
            remaining: result.remaining,
            reset: result.reset,
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'X-RateLimit-Limit': result.limit.toString(),
                'X-RateLimit-Remaining': result.remaining.toString(),
                'X-RateLimit-Reset': result.reset.toString(),
                'Retry-After': Math.ceil((result.reset * 1000 - Date.now()) / 1000).toString(),
            },
        }
    );
}
