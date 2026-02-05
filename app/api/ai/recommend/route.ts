/**
 * AI Recommendations API
 * POST /api/ai/recommend
 * 
 * Security: Authentication required, rate limited, input validated
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
    getIntelligentRecommendations,
} from '@/lib/services/ml-service';
import { recommendationsSchema } from '@/lib/validations/api-validations';
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

export async function POST(req: NextRequest) {
    try {
        // 1. Authentication check
        const { userId } = await auth();

        if (!userId) {
            return authError('Please sign in to get personalized recommendations');
        }

        // 2. Rate limiting
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, RateLimitPresets.ai);

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Parse and validate request body
        const body = await req.json();
        const validatedData = recommendationsSchema.parse(body);

        // 4. Get intelligent recommendations
        const recommendations = await getIntelligentRecommendations(
            userId,
            validatedData.ingredients,
            validatedData.preferences || {},
            validatedData.limit
        );

        return successResponse({
            recommendations,
            count: recommendations.length,
        });
    } catch (error) {
        // Handle Zod validation errors
        if (error && typeof error === 'object' && 'issues' in error) {
            return validationError('Invalid request data', error);
        }

        return handleApiError(
            error,
            'Failed to generate recommendations. Please try again.',
            500
        );
    }
}

