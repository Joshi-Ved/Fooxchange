/**
 * Recipe Analysis API - AI-powered insights
 * POST /api/ai/analyze
 * 
 * Security: Authentication required, rate limited, input validated
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
    predictCookingDifficulty,
    estimateNutrition,
    generateCookingTips,
} from '@/lib/services/ml-service';
import { analyzeRecipeSchema } from '@/lib/validations/api-validations';
import {
    checkRateLimit,
    RateLimitPresets,
    getClientIdentifier,
    rateLimitExceededResponse
} from '@/lib/middleware/rate-limit';
import {
    handleApiError,
    authError,
    validationError,
    notFoundError,
    successResponse
} from '@/lib/utils/error-handling';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        // 1. Authentication check
        const { userId } = await auth();

        if (!userId) {
            return authError('Please sign in to analyze recipes');
        }

        // 2. Rate limiting
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, RateLimitPresets.ai);

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Parse and validate request
        const body = await req.json();
        const validatedData = analyzeRecipeSchema.parse(body);

        // 4. Fetch recipe with timeout
        let fetchTimeoutId: ReturnType<typeof setTimeout>;
        const recipe = await Promise.race([
            db.recipe.findUnique({
                where: { id: validatedData.recipeId },
                include: {
                    ingredients: {
                        include: {
                            ingredient: true,
                        },
                    },
                    steps: {
                        orderBy: {
                            order: 'asc',
                        },
                    },
                },
            }),
            new Promise<null>((_, reject) => {
                fetchTimeoutId = setTimeout(() => reject(new Error('Database timeout')), 5000);
            })
        ]).finally(() => clearTimeout(fetchTimeoutId!));

        if (!recipe) {
            return notFoundError('Recipe');
        }

        // 5. Run ML analysis in parallel with timeout
        let analysisTimeoutId: ReturnType<typeof setTimeout>;
        const analysisPromise = Promise.all([
            predictCookingDifficulty(recipe),
            estimateNutrition(recipe),
            generateCookingTips(recipe),
        ]);

        const [difficulty, nutrition, tips] = await Promise.race([
            analysisPromise,
            new Promise<never>((_, reject) => {
                analysisTimeoutId = setTimeout(() => reject(new Error('Analysis timeout')), 10000);
            })
        ]).finally(() => clearTimeout(analysisTimeoutId!));

        return successResponse({
            recipeId: validatedData.recipeId,
            analysis: {
                difficulty,
                nutrition,
                tips,
            },
        });
    } catch (error) {
        // Handle Zod validation errors
        if (error && typeof error === 'object' && 'issues' in error) {
            return validationError('Invalid request data', error);
        }

        return handleApiError(
            error,
            'Analysis failed. Please try again.',
            500
        );
    }
}
