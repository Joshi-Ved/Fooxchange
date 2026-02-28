/**
 * Recipe Sync API — Background Sync Endpoint
 * POST /api/recipes/sync
 *
 * Receives recipes queued offline by the service worker's background sync.
 * Validates the data, creates the recipe, and generates embeddings.
 *
 * Security: Requires authentication, rate limited
 */

import { NextRequest } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { recipeFormSchema } from '@/lib/validations';
import { generateRecipeEmbedding } from '@/lib/services/embedding-service';
import {
    checkRateLimit,
    RateLimitPresets,
    getClientIdentifier,
    rateLimitExceededResponse
} from '@/lib/middleware/rate-limit';
import {
    handleApiError,
    validationError,
    authError,
    successResponse
} from '@/lib/utils/error-handling';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        // 1. Authentication required
        const { userId } = await auth();
        const user = await currentUser();

        if (!userId || !user) {
            return authError('Authentication required for recipe sync');
        }

        // 2. Rate limiting
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, RateLimitPresets.standard);

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Parse and validate body
        const body = await req.json();

        let validatedData;
        try {
            validatedData = recipeFormSchema.parse(body);
        } catch (error) {
            return validationError('Invalid recipe data', error);
        }

        // 4. Find or create db user
        let dbUser = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if (!dbUser) {
            dbUser = await db.user.create({
                data: {
                    clerkId: userId,
                    email: user.emailAddresses[0]?.emailAddress ?? '',
                    name: user.fullName ?? user.firstName ?? 'Anonymous Chef',
                    avatarUrl: user.imageUrl,
                },
            });
        }

        // 5. Create recipe in a transaction
        const recipe = await db.$transaction(async (tx) => {
            const newRecipe = await tx.recipe.create({
                data: {
                    title: validatedData.title,
                    description: validatedData.description,
                    imageUrl: validatedData.imageUrl || null,
                    prepTime: validatedData.prepTime || null,
                    cookTime: validatedData.cookTime || null,
                    servings: validatedData.servings,
                    difficulty: validatedData.difficulty,
                    authorId: dbUser.id,
                },
            });

            // Create ingredients
            for (const ing of validatedData.ingredients) {
                const slug = ing.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

                let ingredient = await tx.ingredient.findUnique({
                    where: { slug },
                });

                if (!ingredient) {
                    ingredient = await tx.ingredient.create({
                        data: { name: ing.name, slug },
                    });
                }

                await tx.recipeIngredient.create({
                    data: {
                        recipeId: newRecipe.id,
                        ingredientId: ingredient.id,
                        amount: ing.amount,
                        isOptional: ing.isOptional,
                    },
                });
            }

            // Create steps
            for (let i = 0; i < validatedData.steps.length; i++) {
                await tx.step.create({
                    data: {
                        recipeId: newRecipe.id,
                        order: i + 1,
                        content: validatedData.steps[i].content,
                        imageUrl: validatedData.steps[i].imageUrl || null,
                    },
                });
            }

            return newRecipe;
        });

        // 6. Generate embedding (background, but don't lose errors silently)
        const ingredientNames = validatedData.ingredients.map((i) => i.name);
        try {
            const embedding = await generateRecipeEmbedding(
                validatedData.title,
                validatedData.description,
                ingredientNames
            );
            await db.recipeEmbedding.upsert({
                where: { recipeId: recipe.id },
                create: {
                    recipeId: recipe.id,
                    embedding: JSON.stringify(embedding),
                },
                update: {
                    embedding: JSON.stringify(embedding),
                },
            });
            console.log(`[Sync] Embedding generated for synced recipe ${recipe.id}`);
        } catch (err) {
            console.error('[Sync] Embedding generation failed (non-critical):', err);
        }

        return successResponse({
            recipeId: recipe.id,
            message: 'Recipe synced successfully',
        });
    } catch (error) {
        return handleApiError(
            error,
            'Recipe sync failed. Please try again.',
            500
        );
    }
}
