/**
 * Rate Limiting Service
 * 
 * Implements server-side rate limiting for AI endpoints
 * Supports different limits for free and pro users
 */

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number; // Time window in milliseconds
}

interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp
}

// In-memory store (use Redis/Vercel KV in production)
const rateLimitStore = new Map<string, { requests: number[]; }>();

/**
 * Clean up expired entries
 */
function cleanupExpired(windowMs: number) {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        value.requests = value.requests.filter(time => now - time < windowMs);
        if (value.requests.length === 0) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Check and update rate limit for a user
 */
export async function checkRateLimit(
    userId: string,
    endpoint: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const key = `${userId}:${endpoint}`;
    const now = Date.now();

    // Cleanup old entries
    cleanupExpired(config.windowMs);

    // Get or create entry
    const entry = rateLimitStore.get(key) || { requests: [] };

    // Filter requests within the window
    entry.requests = entry.requests.filter(time => now - time < config.windowMs);

    // Check if limit exceeded
    if (entry.requests.length >= config.maxRequests) {
        const oldestRequest = Math.min(...entry.requests);
        const reset = oldestRequest + config.windowMs;

        return {
            success: false,
            limit: config.maxRequests,
            remaining: 0,
            reset,
        };
    }

    // Add new request
    entry.requests.push(now);
    rateLimitStore.set(key, entry);

    const reset = now + config.windowMs;

    return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - entry.requests.length,
        reset,
    };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
    vision: {
        free: { maxRequests: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 per day
        pro: { maxRequests: 50, windowMs: 24 * 60 * 60 * 1000 }, // 50 per day
    },
    recommendations: {
        free: { maxRequests: 20, windowMs: 24 * 60 * 60 * 1000 }, // 20 per day
        pro: { maxRequests: 200, windowMs: 24 * 60 * 60 * 1000 }, // 200 per day
    },
    search: {
        free: { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
        pro: { maxRequests: 1000, windowMs: 60 * 60 * 1000 }, // 1000 per hour
    },
    analysis: {
        free: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
        pro: { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
    },
} as const;

/**
 * Get user tier (free or pro)
 * TODO: Implement actual tier checking from database/auth
 */
export function getUserTier(userId: string): 'free' | 'pro' {
    // For now, all users are free
    // In production, check user subscription status
    return 'free';
}

/**
 * Middleware function for rate limiting
 */
export async function rateLimitMiddleware(
    userId: string,
    endpoint: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
    const tier = getUserTier(userId);
    const config = RATE_LIMITS[endpoint][tier];

    return await checkRateLimit(userId, endpoint, config);
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
    };
}
