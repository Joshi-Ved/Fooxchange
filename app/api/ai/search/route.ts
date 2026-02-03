/**
 * Semantic Search API
 * GET /api/ai/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchRecipesBySemantic } from '@/lib/services/search-service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q');
        const limit = parseInt(searchParams.get('limit') || '10');
        const threshold = parseFloat(searchParams.get('threshold') || '0.7');

        if (!query) {
            return NextResponse.json(
                { error: 'Query parameter "q" is required' },
                { status: 400 }
            );
        }

        const results = await searchRecipesBySemantic(query, limit, threshold);

        return NextResponse.json({
            success: true,
            query,
            results,
            count: results.length,
        });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            {
                error: 'Search failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
