/**
 * Health Check Endpoint
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/services/analytics';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const health = await healthCheck();

        const statusCode =
            health.status === 'healthy' ? 200 :
                health.status === 'degraded' ? 200 :
                    503;

        return NextResponse.json(health, { status: statusCode });
    } catch (error) {
        return NextResponse.json(
            {
                status: 'down',
                error: 'Health check failed',
            },
            { status: 503 }
        );
    }
}
