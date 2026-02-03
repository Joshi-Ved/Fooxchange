/**
 * AI Recommendations API
 * POST /api/ai/recommend
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getIntelligentRecommendations,
    UserPreferences,
} from '@/lib/services/ml-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const session = { user: { id: 'demo-user' } }; // Demo for testing

        const body = await req.json();
        const { ingredients, preferences, limit = 10 } = body;

        if (!ingredients || !Array.isArray(ingredients)) {
            return NextResponse.json(
                { error: 'Ingredients array is required' },
                { status: 400 }
            );
        }

        // Get intelligent recommendations
        const recommendations = await getIntelligentRecommendations(
            session.user.id,
            ingredients,
            preferences as UserPreferences,
            limit
        );

        return NextResponse.json({
            success: true,
            recommendations,
            count: recommendations.length,
        });
    } catch (error) {
        console.error('Recommendation API error:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate recommendations',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
