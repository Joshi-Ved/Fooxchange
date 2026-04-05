/**
 * Voice-to-Recipe Suggestion API
 * POST /api/ai/voice-recommend
 *
 * Accepts a natural-language voice query and returns ranked recipes.
 * Works for signed-in and signed-out users.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { searchRecipesBySemantic } from '@/lib/services/search-service';
import {
    checkRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/middleware/rate-limit';
import {
    handleApiError,
    validationError,
    successResponse,
} from '@/lib/utils/error-handling';

export const runtime = 'nodejs';

const voiceRecommendSchema = z.object({
    query: z.string().min(3).max(300),
    limit: z.number().min(1).max(10).default(5),
});

function tokenize(input: string): string[] {
    return Array.from(
        new Set(
            input
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .map((token) => token.trim())
                .filter((token) => token.length >= 3)
        )
    );
}

function buildReason(matchPercent: number, query: string): string {
    if (matchPercent >= 75) {
        return `Strong ingredient match for your query: "${query}"`;
    }
    if (matchPercent >= 45) {
        return `Good ingredient overlap for your voice request`;
    }
    return 'Semantically similar to what you asked for';
}

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();

        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, {
            maxRequests: 30,
            windowSeconds: 60,
        });
        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        const body = await req.json();
        const parsed = voiceRecommendSchema.safeParse(body);
        if (!parsed.success) {
            return validationError('Invalid voice query', parsed.error.flatten());
        }

        const { query, limit } = parsed.data;
        const tokens = tokenize(query);

        const ingredientCandidates = await db.ingredient.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { slug: { contains: query.replace(/\s+/g, '-'), mode: 'insensitive' } },
                    ...tokens.map((token) => ({ name: { contains: token, mode: 'insensitive' as const } })),
                    ...tokens.map((token) => ({ slug: { contains: token, mode: 'insensitive' as const } })),
                ],
            },
            select: { id: true, name: true },
            take: 30,
        });

        const ingredientIdSet = new Set(ingredientCandidates.map((item) => item.id));

        const ingredientMatchedRecipes = await db.recipe.findMany({
            where: ingredientIdSet.size
                ? {
                    ingredients: {
                        some: {
                            ingredientId: { in: Array.from(ingredientIdSet) },
                        },
                    },
                }
                : undefined,
            include: {
                ingredients: {
                    include: {
                        ingredient: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 40,
        });

        const semanticResults = await searchRecipesBySemantic(query, limit * 3, 0.5);

        const merged = new Map<string, {
            recipe: {
                id: string;
                title: string;
                description: string;
                imageUrl: string | null;
                prepTime: number | null;
                cookTime: number | null;
                difficulty: string;
            };
            matchPercent: number;
            reason: string;
            score: number;
        }>();

        for (const recipe of ingredientMatchedRecipes) {
            const total = Math.max(1, recipe.ingredients.length);
            const matched = recipe.ingredients.filter((ri) => ingredientIdSet.has(ri.ingredient.id)).length;
            const matchPercent = Math.round((matched / total) * 100);
            const score = matchPercent / 100;

            merged.set(recipe.id, {
                recipe: {
                    id: recipe.id,
                    title: recipe.title,
                    description: recipe.description,
                    imageUrl: recipe.imageUrl,
                    prepTime: recipe.prepTime,
                    cookTime: recipe.cookTime,
                    difficulty: recipe.difficulty,
                },
                matchPercent,
                reason: buildReason(matchPercent, query),
                score,
            });
        }

        for (const item of semanticResults) {
            const similarity = item.similarity;
            const matchPercent = Math.round(similarity * 100);
            const existing = merged.get(item.recipe.id);
            if (existing && existing.score >= similarity) {
                continue;
            }

            merged.set(item.recipe.id, {
                recipe: {
                    id: item.recipe.id,
                    title: item.recipe.title,
                    description: item.recipe.description,
                    imageUrl: item.recipe.imageUrl,
                    prepTime: item.recipe.prepTime,
                    cookTime: item.recipe.cookTime,
                    difficulty: item.recipe.difficulty,
                },
                matchPercent,
                reason: buildReason(matchPercent, query),
                score: similarity,
            });
        }

        const suggestions = Array.from(merged.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ score: _score, ...rest }) => rest);

        return successResponse({
            query,
            suggestions,
            detectedIngredients: ingredientCandidates.map((item) => item.name),
        });
    } catch (error) {
        return handleApiError(error, 'Failed to process voice recipe query');
    }
}
