/**
 * Health Check Endpoint
 * GET /api/health
 * 
 * Used by: local uptime probes, container health checks, and deployment monitors
 * Returns 200 for healthy/degraded (app is running), 503 for down.
 */

import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/services/analytics';

export const runtime = 'nodejs';

// Prevent caching of health checks
export const dynamic = 'force-dynamic';

export async function GET() {
    const startTime = Date.now();

    try {
        const health = await healthCheck();

        const statusCode =
            health.status === 'healthy' ? 200 :
                health.status === 'degraded' ? 200 :
                    503;

        return NextResponse.json(
            {
                ...health,
                uptime: process.uptime(),
                responseTimeMs: Date.now() - startTime,
                version: process.env.npm_package_version || '0.1.0',
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString(),
            },
            { status: statusCode }
        );
    } catch (error) {
        return NextResponse.json(
            {
                status: 'down',
                error: 'Health check failed',
                uptime: process.uptime(),
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            },
            { status: 503 }
        );
    }
}
