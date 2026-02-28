/**
 * Personalized Feed API
 * GET /api/ai/personalized
 * 
 * Security: Authentication required, rate limited, input validated
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
    learnUserTasteProfile,
    getCollaborativeRecommendations,
    predictUserPreferences,
} from '@/lib/services/dl-service';
import { db } from '@/lib/db';
import { personalizedFeedSchema } from '@/lib/validations/api-validations';
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
    successResponse
} from '@/lib/utils/error-handling';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        // 1. Authentication check
        const { userId } = await auth();

        if (!userId) {
            return authError('Please sign in to get your personalized feed');
        }

        // 2. Rate limiting
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, RateLimitPresets.ai);

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Parse and validate query params
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const includeReasons = searchParams.get('includeReasons') === 'true';

        const validatedData = personalizedFeedSchema.parse({
            limit,
            includeReasons,
        });

        // 4. Learn user's taste profile with timeout
        let tasteTimeoutId: ReturnType<typeof setTimeout>;
        const tasteProfile = await Promise.race([
            learnUserTasteProfile(userId),
            new Promise<any>((_, reject) => {
                tasteTimeoutId = setTimeout(() => reject(new Error('Taste profile timeout')), 10000);
            })
        ]).finally(() => clearTimeout(tasteTimeoutId!));

        // 5. Get collaborative recommendations with timeout
        let collabTimeoutId: ReturnType<typeof setTimeout>;
        const collaborativeRecs = await Promise.race([
            getCollaborativeRecommendations(userId, validatedData.limit),
            new Promise<any[]>((_, reject) => {
                collabTimeoutId = setTimeout(() => reject(new Error('Collaborative timeout')), 10000);
            })
        ]).finally(() => clearTimeout(collabTimeoutId!));

        // 6. Get recent recipes as candidates for prediction
        let dbTimeoutId: ReturnType<typeof setTimeout>;
        const recentRecipes = await Promise.race([
            db.recipe.findMany({
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
            }),
            new Promise<never>((_, reject) => {
                dbTimeoutId = setTimeout(() => reject(new Error('Database timeout')), 5000);
            })
        ]).finally(() => clearTimeout(dbTimeoutId!));

        // 7. Predict user preferences with timeout
        let predTimeoutId: ReturnType<typeof setTimeout>;
        const predictions = await Promise.race([
            predictUserPreferences(userId, recentRecipes),
            new Promise<any[]>((_, reject) => {
                predTimeoutId = setTimeout(() => reject(new Error('Prediction timeout')), 15000);
            })
        ]).finally(() => clearTimeout(predTimeoutId!));

        // 8. Combine and deduplicate
        const feedRecipes = [
            ...predictions.slice(0, Math.floor(validatedData.limit / 2)).map((p) => ({
                recipe: p.recipe,
                score: p.predictedScore,
                reason: `${Math.round(p.predictedScore * 100)}% match based on your taste`,
                confidence: p.confidence,
            })),
            ...collaborativeRecs.slice(0, Math.floor(validatedData.limit / 2)).map((recipe) => ({
                recipe,
                score: 0.8,
                reason: 'Recommended by users with similar tastes',
                confidence: 0.75,
            })),
        ];

        // Deduplicate by recipe ID
        const uniqueRecipes = Array.from(
            new Map(feedRecipes.map((item) => [item.recipe.id, item])).values()
        ).slice(0, validatedData.limit);

        return successResponse({
            tasteProfile,
            feed: uniqueRecipes,
            count: uniqueRecipes.length,
        });
    } catch (error) {
        // Handle Zod validation errors
        if (error && typeof error === 'object' && 'issues' in error) {
            return validationError('Invalid request parameters', error);
        }

        return handleApiError(
            error,
            'Failed to generate personalized feed. Please try again.',
            500
        );
    }
}
