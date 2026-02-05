/**
 * Secure Error Handling Utilities
 * Prevents sensitive information leakage in production
 */

import { NextResponse } from 'next/server';

/**
 * Sanitized error response for API routes
 * Logs full error server-side, returns safe message to client
 */
export function handleApiError(
    error: unknown,
    fallbackMessage: string = 'An unexpected error occurred',
    statusCode: number = 500
): NextResponse {
    // Log full error server-side for debugging
    console.error('[API Error]', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
    });

    // In development, return detailed error
    if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
            {
                error: fallbackMessage,
                details: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            },
            { status: statusCode }
        );
    }

    // In production, return generic message only
    return NextResponse.json(
        {
            error: fallbackMessage,
            timestamp: new Date().toISOString(),
        },
        { status: statusCode }
    );
}

/**
 * Validation error response
 */
export function validationError(message: string, details?: any): NextResponse {
    console.warn('[Validation Error]', message, details);

    return NextResponse.json(
        {
            error: 'Validation failed',
            message,
            ...(process.env.NODE_ENV === 'development' && { details }),
        },
        { status: 400 }
    );
}

/**
 * Authentication error response
 */
export function authError(message: string = 'Unauthorized'): NextResponse {
    return NextResponse.json(
        {
            error: message,
            message: 'Please sign in to access this resource',
        },
        { status: 401 }
    );
}

/**
 * Authorization error response (forbidden)
 */
export function forbiddenError(message: string = 'Forbidden'): NextResponse {
    return NextResponse.json(
        {
            error: message,
            message: 'You do not have permission to access this resource',
        },
        { status: 403 }
    );
}

/**
 * Not found error response
 */
export function notFoundError(resource: string = 'Resource'): NextResponse {
    return NextResponse.json(
        {
            error: 'Not found',
            message: `${resource} not found`,
        },
        { status: 404 }
    );
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, message?: string): NextResponse {
    return NextResponse.json({
        success: true,
        ...(message && { message }),
        data,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Extract safe error message
 * Prevents leaking sensitive information
 */
export function getSafeErrorMessage(error: unknown): string {
    if (process.env.NODE_ENV === 'development') {
        return error instanceof Error ? error.message : String(error);
    }

    // In production, return generic messages only
    if (error instanceof Error) {
        // Map known errors to safe messages
        if (error.message.includes('ECONNREFUSED')) {
            return 'Service temporarily unavailable';
        }
        if (error.message.includes('timeout')) {
            return 'Request timed out';
        }
        if (error.message.includes('ENOTFOUND')) {
            return 'Service unavailable';
        }
        if (error.message.includes('network')) {
            return 'Network error occurred';
        }
    }

    return 'An unexpected error occurred';
}

/**
 * Async error boundary for API routes
 */
export async function withErrorHandling<T>(
    fn: () => Promise<T>,
    fallbackMessage?: string
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        // Re-throw with sanitized message in production
        if (process.env.NODE_ENV === 'production') {
            throw new Error(getSafeErrorMessage(error));
        }
        throw error;
    }
}
