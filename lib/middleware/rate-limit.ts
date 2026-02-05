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

// In-memory store (use Redis in production for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (value.resetAt < now) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

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
 * Helper to get client identifier
 * Prefers userId, falls back to IP address
 */
export function getClientIdentifier(request: Request, userId?: string | null): string {
    if (userId) {
        return `user:${userId}`;
    }

    // Try to get IP from various headers (proxies, CDN)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare

    const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';

    return `ip:${ip}`;
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
