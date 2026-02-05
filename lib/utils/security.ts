/**
 * Security utilities and middleware
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): {
    valid: boolean;
    error?: string;
} {
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid file type. Allowed types: JPEG, PNG, WebP',
        };
    }

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File too large. Maximum size: 5MB',
        };
    }

    // Check if file actually exists
    if (file.size === 0) {
        return {
            valid: false,
            error: 'Empty file provided',
        };
    }

    return { valid: true };
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
    const headers = response.headers;

    // Prevent clickjacking
    headers.set('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    headers.set('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    headers.set('X-XSS-Protection', '1; mode=block');

    // Content Security Policy
    headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );

    // Referrer Policy
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    headers.set(
        'Permissions-Policy',
        'camera=(self), microphone=(), geolocation=(), payment=()'
    );

    return response;
}

/**
 * Validate API key exists
 */
export function validateAPIKey(key: string | undefined, name: string): {
    valid: boolean;
    error?: string;
} {
    if (!key || key.trim() === '') {
        return {
            valid: false,
            error: `${name} is not configured`,
        };
    }

    return { valid: true };
}

/**
 * Extract user ID from request (works with or without auth)
 */
export function getUserIdFromRequest(request: NextRequest): string {
    // Try to get from auth session (would be set by middleware)
    const userId = request.headers.get('x-user-id');

    if (userId) {
        return userId;
    }

    // Fallback to demo user (for testing)
    return 'demo-user';
}

/**
 * CORS configuration for API routes
 */
export function configureCORS(request: NextRequest): {
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
} {
    const origin = request.headers.get('origin') || '*';

    // In production, whitelist specific domains
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

/**
 * Log security events
 */
export function logSecurityEvent(event: {
    type: 'rate_limit' | 'invalid_input' | 'unauthorized' | 'suspicious_activity';
    userId?: string;
    endpoint: string;
    details?: any;
}): void {
    // In production, send to monitoring service (Sentry, LogRocket, etc.)
    console.warn('[SECURITY]', {
        timestamp: new Date().toISOString(),
        ...event,
    });
}
