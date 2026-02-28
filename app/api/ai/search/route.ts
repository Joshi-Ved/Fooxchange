/**
 * Semantic Search API
 * GET /api/ai/search
 * 
 * Security: Rate limited, input validated
 * Note: Public endpoint - no auth required for browsing
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchRecipesBySemantic } from '@/lib/services/search-service';
import { semanticSearchSchema } from '@/lib/validations/api-validations';
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
        // 1. Get user ID (optional for search - can be anonymous)
        const { userId } = await auth();

        // 2. Rate limiting (use IP for anonymous users)
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, RateLimitPresets.standard);

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Parse and validate query params
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q') ?? '';
        const limit = parseInt(searchParams.get('limit') ?? '12');
        const threshold = parseFloat(searchParams.get('threshold') ?? '0.7');

        if (!query) {
            return validationError('Query parameter "q" is required');
        }

        // Validate with schema
        const validatedData = semanticSearchSchema.parse({
            query,
            limit,
        });

        // 4. Perform search with timeout
        let searchTimeoutId: ReturnType<typeof setTimeout>;
        const results = await Promise.race([
            searchRecipesBySemantic(validatedData.query, validatedData.limit, threshold),
            new Promise<never>((_, reject) => {
                searchTimeoutId = setTimeout(() => reject(new Error('Search timeout')), 10000);
            })
        ]).finally(() => clearTimeout(searchTimeoutId!));

        return successResponse({
            query: validatedData.query,
            results,
            count: results.length,
        });
    } catch (error) {
        // Handle Zod validation errors
        if (error && typeof error === 'object' && 'issues' in error) {
            return validationError('Invalid search parameters', error);
        }

        return handleApiError(
            error,
            'Search failed. Please try again.',
            500
        );
    }
}
