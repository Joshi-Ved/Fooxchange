/**
 * Vector Search API — Client-to-Server Edge AI Pipeline
 * POST /api/ai/search/vector
 *
 * Receives a 384-dim embedding vector generated client-side (Edge Search)
 * and performs semantic similarity search against stored recipe embeddings.
 *
 * Security: Rate limited, vector validated, optional auth
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { cosineSimilarity } from '@/lib/services/embedding-service';
import { validateVectorFromRequest } from '@/lib/security/vector-validation';
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

export async function POST(req: NextRequest) {
    try {
        // 1. Get user ID (optional — search can be anonymous)
        const { userId } = await auth();

        // 2. Rate limiting (AI preset: 10 req/min)
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, RateLimitPresets.ai);

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Parse and validate request body
        const body = await req.json();

        // Validate vector using security utility (checks dims, range, anomalies)
        let queryVector: number[];
        try {
            queryVector = validateVectorFromRequest(body, 'vector');
        } catch (error) {
            return validationError(
                error instanceof Error ? error.message : 'Invalid vector'
            );
        }

        const limit = Math.min(Math.max(1, body.limit ?? 12), 50);
        const threshold = Math.min(Math.max(0, body.threshold ?? 0.5), 1);

        // 4. Fetch all recipe embeddings with recipe data
        const recipeEmbeddings = await Promise.race([
            db.recipeEmbedding.findMany({
                include: {
                    recipe: {
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
                    },
                },
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Database timeout')), 10000)
            )
        ]);

        // 5. Calculate similarity scores using server-side cosine similarity
        const results = recipeEmbeddings
            .map((re) => {
                const storedEmbedding = JSON.parse(re.embedding) as number[];

                // Skip if dimensions don't match (stale data from old model)
                if (storedEmbedding.length !== queryVector.length) {
                    return null;
                }

                const similarity = cosineSimilarity(queryVector, storedEmbedding);

                return {
                    recipe: re.recipe,
                    similarity: Math.round(similarity * 10000) / 10000, // 4 decimal places
                };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null && r.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return successResponse({
            results,
            count: results.length,
            threshold,
            dimensions: queryVector.length,
        });
    } catch (error) {
        return handleApiError(
            error,
            'Vector search failed. Please try again.',
            500
        );
    }
}
