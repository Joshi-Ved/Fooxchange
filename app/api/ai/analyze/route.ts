/**
 * Recipe Analysis API - AI-powered insights
 * POST /api/ai/analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
    predictCookingDifficulty,
    estimateNutrition,
    generateCookingTips,
} from '@/lib/services/ml-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const session = { user: { id: 'demo-user' } }; // Demo for testing

        const { recipeId } = await req.json();

        if (!recipeId) {
            return NextResponse.json(
                { error: 'Recipe ID is required' },
                { status: 400 }
            );
        }

        // Fetch recipe
        const recipe = await db.recipe.findUnique({
            where: { id: recipeId },
            include: {
                ingredients: {
                    include: {
                        ingredient: true,
                    },
                },
            },
        });

        if (!recipe) {
            return NextResponse.json(
                { error: 'Recipe not found' },
                { status: 404 }
            );
        }

        // Run ML analysis in parallel
        const [difficulty, nutrition, tips] = await Promise.all([
            predictCookingDifficulty(recipe),
            estimateNutrition(recipe),
            generateCookingTips(recipe),
        ]);

        return NextResponse.json({
            success: true,
            recipeId,
            analysis: {
                difficulty,
                nutrition,
                tips,
            },
        });
    } catch (error) {
        console.error('Analysis API error:', error);
        return NextResponse.json(
            {
                error: 'Analysis failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
