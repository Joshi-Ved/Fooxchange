/**
 * Personalized Feed API
 * GET /api/ai/personalized
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    learnUserTasteProfile,
    getCollaborativeRecommendations,
    predictUserPreferences,
} from '@/lib/services/dl-service';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        const session = { user: { id: 'demo-user' } }; // Demo for testing

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20');

        // Learn user's taste profile
        const tasteProfile = await learnUserTasteProfile(session.user.id);

        // Get collaborative recommendations
        const collaborativeRecs = await getCollaborativeRecommendations(
            session.user.id,
            limit
        );

        // Get recent recipes as candidates for prediction
        const recentRecipes = await db.recipe.findMany({
            take: 100,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                author: {
                    select: {
                        name: true,
                        avatarUrl: true,
                    },
                },
                ingredients: {
                    include: {
                        ingredient: true,
                    },
                },
                _count: {
                    select: {
                        savedBy: true,
                    },
                },
            },
        });

        // Predict user preferences
        const predictions = await predictUserPreferences(
            session.user.id,
            recentRecipes
        );

        // Combine and deduplicate
        const feedRecipes = [
            ...predictions.slice(0, limit / 2).map((p) => ({
                recipe: p.recipe,
                score: p.predictedScore,
                reason: `${Math.round(p.predictedScore * 100)}% match based on your taste`,
                confidence: p.confidence,
            })),
            ...collaborativeRecs.slice(0, limit / 2).map((recipe) => ({
                recipe,
                score: 0.8,
                reason: 'Recommended by users with similar tastes',
                confidence: 0.75,
            })),
        ];

        // Deduplicate by recipe ID
        const uniqueRecipes = Array.from(
            new Map(feedRecipes.map((item) => [item.recipe.id, item])).values()
        ).slice(0, limit);

        return NextResponse.json({
            success: true,
            tasteProfile,
            feed: uniqueRecipes,
            count: uniqueRecipes.length,
        });
    } catch (error) {
        console.error('Personalized feed error:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate personalized feed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
