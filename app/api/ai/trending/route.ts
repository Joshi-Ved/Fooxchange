/**
 * Trending Recipes API
 * GET /api/ai/trending
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrendingRecipes } from '@/lib/services/dl-service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const timeWindow = parseInt(searchParams.get('hours') || '24');
        const limit = parseInt(searchParams.get('limit') || '10');

        const trending = await getTrendingRecipes(timeWindow, limit);

        return NextResponse.json({
            success: true,
            trending,
            timeWindow,
            count: trending.length,
        });
    } catch (error) {
        console.error('Trending API error:', error);
        return NextResponse.json(
            {
                error: 'Failed to get trending recipes',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
