/**
 * Trending Recipes API
 * GET /api/ai/trending
 * 
 * Security: Rate limited, input validated
 * Note: Public endpoint - no auth required
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTrendingRecipes } from '@/lib/services/dl-service';
import { trendingRecipesSchema } from '@/lib/validations/api-validations';
import {
    checkRateLimit,
    RateLimitPresets,
    getClientIdentifier,
    rateLimitExceededResponse
} from '@/lib/middleware/rate-limit';
import {
    handleApiError,
    validationError,
    successResponse
} from '@/lib/utils/error-handling';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        // 1. Get user ID (optional - trending is public)
        const { userId } = await auth();

        // 2. Rate limiting (use IP for anonymous users)
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, RateLimitPresets.standard);

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Parse and validate query params
        const { searchParams } = new URL(req.url);
        const timeWindow = searchParams.get('timeWindow') ?? 'week';
        const limit = parseInt(searchParams.get('limit') ?? '10');

        const validatedData = trendingRecipesSchema.parse({
            timeWindow,
            limit,
        });

        // Convert time window to hours
        const hoursMap = {
            day: 24,
            week: 24 * 7,
            month: 24 * 30,
            all: 24 * 365,
        };
        const hours = hoursMap[validatedData.timeWindow];

        // 4. Get trending recipes with timeout
        const trending = await Promise.race([
            getTrendingRecipes(hours, validatedData.limit),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Trending query timeout')), 10000)
            )
        ]);

        return successResponse({
            trending,
            timeWindow: validatedData.timeWindow,
            hours,
            count: trending.length,
        });
    } catch (error) {
        // Handle Zod validation errors
        if (error && typeof error === 'object' && 'issues' in error) {
            return validationError('Invalid request parameters', error);
        }

        return handleApiError(
            error,
            'Failed to get trending recipes. Please try again.',
            500
        );
    }
}
