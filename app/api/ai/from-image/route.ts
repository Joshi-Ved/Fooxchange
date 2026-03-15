/**
 * Image-to-Recipe Suggestion API
 * POST /api/ai/from-image
 *
 * Accepts a list of ingredient names detected by the camera scanner
 * (COCO-SSD or the custom YOLO food model) and returns ranked recipe
 * suggestions that best match the detected ingredients.
 *
 * Security: Authentication required, rate limited
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import {
    checkRateLimit,
    RateLimitPresets,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/middleware/rate-limit';
import {
    handleApiError,
    authError,
    validationError,
    successResponse,
} from '@/lib/utils/error-handling';

export const runtime = 'nodejs';

// ── Request schema ────────────────────────────────────────────────────────────
const fromImageSchema = z.object({
    /** Names as returned by the vision model, e.g. ["tomato", "onion", "chicken"] */
    detectedIngredients: z
        .array(z.string().min(1).max(100))
        .min(1, 'At least one ingredient required')
        .max(30, 'Too many ingredients'),

    /** Optional preference hints from the user */
    preferences: z
        .object({
            maxPrepTime: z.number().optional(),    // minutes
            difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
            servings: z.number().min(1).max(20).optional(),
        })
        .optional(),

    limit: z.number().min(1).max(20).default(6),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a detected name to a plain lowercase string for matching.
 * e.g. "hot dog" → "hot dog", "Green Chili" → "green chili"
 */
function normalise(name: string): string {
    return name.trim().toLowerCase().replace(/[_-]/g, ' ');
}

/**
 * Try to match a detected ingredient name against the Ingredient table.
 * Uses exact match first, then partial, then word-overlap.
 */
async function resolveIngredientIds(detectedNames: string[]): Promise<string[]> {
    const resolvedIds = new Set<string>();

    for (const raw of detectedNames) {
        const name = normalise(raw);

        // 1. Exact or slug match
        const exact = await db.ingredient.findFirst({
            where: {
                OR: [
                    { name: { equals: name, mode: 'insensitive' } },
                    { slug: { equals: name.replace(/\s/g, '-'), mode: 'insensitive' } },
                ],
            },
            select: { id: true },
        });

        if (exact) {
            resolvedIds.add(exact.id);
            continue;
        }

        // 2. Partial name match (ingredient name contains the detected word)
        const partials = await db.ingredient.findMany({
            where: {
                OR: [
                    { name: { contains: name, mode: 'insensitive' } },
                    { slug: { contains: name.replace(/\s/g, '-'), mode: 'insensitive' } },
                ],
            },
            select: { id: true },
            take: 3,
        });

        partials.forEach((p) => resolvedIds.add(p.id));
    }

    return Array.from(resolvedIds);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        // 1. Auth
        const { userId } = await auth();
        if (!userId) {
            return authError('Please sign in to get recipe suggestions');
        }

        // 2. Rate limit (camera vision is expensive – 20 req / min)
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, {
            maxRequests: 20,
            windowSeconds: 60,
        });
        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Parse & validate
        const body = await req.json();
        const parsed = fromImageSchema.safeParse(body);
        if (!parsed.success) {
            return validationError('Invalid request data', parsed.error.flatten());
        }
        const { detectedIngredients, preferences, limit } = parsed.data;

        // 4. Resolve detected names → ingredient IDs
        const ingredientIds = await resolveIngredientIds(detectedIngredients);

        // 5. Find matching recipes -------------------------------------------------
        //    We do two passes:
        //      a) recipes that contain AT LEAST ONE of the detected ingredients
        //      b) score each recipe by how many ingredients match
        const candidates = await db.recipe.findMany({
            where: {
                ...(preferences?.difficulty && { difficulty: preferences.difficulty }),
                ...(preferences?.maxPrepTime && {
                    OR: [
                        { prepTime: { lte: preferences.maxPrepTime } },
                        { prepTime: null },
                    ],
                }),
                ...(ingredientIds.length > 0 && {
                    ingredients: {
                        some: {
                            ingredientId: { in: ingredientIds },
                        },
                    },
                }),
            },
            include: {
                author: {
                    select: { name: true, avatarUrl: true },
                },
                ingredients: {
                    include: {
                        ingredient: { select: { id: true, name: true } },
                    },
                },
                _count: { select: { savedBy: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50, // fetch more than needed; we'll score & slice
        });

        // 6. Score each candidate
        const ingredientIdSet = new Set(ingredientIds);
        const scored = candidates
            .map((recipe) => {
                const recipeIngIds = recipe.ingredients.map((ri) => ri.ingredient.id);
                const matched = recipeIngIds.filter((id) => ingredientIdSet.has(id)).length;
                const total = recipeIngIds.length || 1;
                const matchScore = matched / total; // 0-1

                // Bonus: shorter total time → higher ranking
                const totalTime = (recipe.prepTime || 30) + (recipe.cookTime || 30);
                const timeBonus = preferences?.maxPrepTime
                    ? Math.max(0, 1 - totalTime / (preferences.maxPrepTime * 2))
                    : 0;

                // Popularity bonus (capped)
                const popularityBonus = Math.min(recipe._count.savedBy / 100, 0.1);

                const score = matchScore * 0.75 + timeBonus * 0.15 + popularityBonus * 0.1;

                return {
                    recipe: {
                        id: recipe.id,
                        title: recipe.title,
                        description: recipe.description,
                        imageUrl: recipe.imageUrl,
                        prepTime: recipe.prepTime,
                        cookTime: recipe.cookTime,
                        difficulty: recipe.difficulty,
                        servings: recipe.servings,
                        savedCount: recipe._count.savedBy,
                        author: recipe.author,
                        ingredients: recipe.ingredients.map((ri) => ({
                            name: ri.ingredient.name,
                            amount: ri.amount,
                            isOptional: ri.isOptional,
                        })),
                    },
                    score: Math.round(score * 100) / 100,
                    matchedIngredients: matched,
                    totalIngredients: total,
                    matchPercent: Math.round((matched / total) * 100),
                    reason: buildReason(matched, total, recipe.title),
                };
            })
            // Remove zero-match results (only relevant when no IDs resolved)
            .filter((r) => r.score > 0 || ingredientIds.length === 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        // 7. If we have very few results, pad with popular recipes
        let suggestions = scored;
        if (suggestions.length < 3) {
            const fallback = await db.recipe.findMany({
                where: {
                    id: { notIn: scored.map((s) => s.recipe.id) },
                },
                include: {
                    author: { select: { name: true, avatarUrl: true } },
                    ingredients: {
                        include: { ingredient: { select: { id: true, name: true } } },
                    },
                    _count: { select: { savedBy: true } },
                },
                orderBy: { savedBy: { _count: 'desc' } },
                take: limit - suggestions.length,
            });

            const fallbackSuggestions = fallback.map((recipe) => ({
                recipe: {
                    id: recipe.id,
                    title: recipe.title,
                    description: recipe.description,
                    imageUrl: recipe.imageUrl,
                    prepTime: recipe.prepTime,
                    cookTime: recipe.cookTime,
                    difficulty: recipe.difficulty,
                    servings: recipe.servings,
                    savedCount: recipe._count.savedBy,
                    author: recipe.author,
                    ingredients: recipe.ingredients.map((ri) => ({
                        name: ri.ingredient.name,
                        amount: ri.amount,
                        isOptional: ri.isOptional,
                    })),
                },
                score: 0,
                matchedIngredients: 0,
                totalIngredients: recipe.ingredients.length,
                matchPercent: 0,
                reason: 'Popular recipe you might enjoy',
            }));

            suggestions = [...suggestions, ...fallbackSuggestions];
        }

        return successResponse({
            suggestions,
            detectedIngredients,
            resolvedCount: ingredientIds.length,
            totalSuggestions: suggestions.length,
        });
    } catch (error) {
        return handleApiError(error, 'Failed to generate recipe suggestions from image');
    }
}

function buildReason(matched: number, total: number, title: string): string {
    const pct = Math.round((matched / total) * 100);
    if (pct >= 80) return `You have ${pct}% of the ingredients for "${title}"`;
    if (pct >= 50) return `You have ${matched} of ${total} ingredients for "${title}"`;
    if (matched === 1) return `Uses one of the ingredients you scanned`;
    return `Great recipe to try with your ingredients`;
}
