"use server";

import { db } from "@/lib/db";

export async function getRecipeById(id: string) {
    try {
        const recipe = await db.recipe.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        name: true,
                        avatarUrl: true,
                        bio: true,
                    },
                },
                ingredients: {
                    include: {
                        ingredient: true,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                },
                steps: {
                    orderBy: {
                        order: "asc",
                    },
                },
                _count: {
                    select: {
                        savedBy: true,
                    },
                },
            },
        });

        return recipe;
    } catch (error) {
        console.error("Error fetching recipe:", error);
        return null;
    }
}

export async function toggleSaveRecipe(clerkUserId: string, recipeId: string) {
    try {
        // Resolve Clerk userId to DB userId
        const dbUser = await db.user.findUnique({
            where: { clerkId: clerkUserId },
            select: { id: true },
        });

        if (!dbUser) {
            throw new Error("User not found");
        }

        // Check if already saved
        const existing = await db.savedRecipe.findUnique({
            where: {
                userId_recipeId: {
                    userId: dbUser.id,
                    recipeId,
                },
            },
        });

        if (existing) {
            // Unsave
            await db.savedRecipe.delete({
                where: {
                    id: existing.id,
                },
            });
            return { saved: false };
        } else {
            // Save
            await db.savedRecipe.create({
                data: {
                    userId: dbUser.id,
                    recipeId,
                },
            });
            return { saved: true };
        }
    } catch (error) {
        console.error("Error toggling save:", error);
        throw new Error("Failed to save recipe");
    }
}

/**
 * Check if a recipe is saved by a user.
 * @param clerkUserId - The Clerk user ID (from auth())
 * @param recipeId - The recipe ID
 */
export async function isRecipeSaved(clerkUserId: string, recipeId: string) {
    try {
        // Resolve Clerk userId to DB userId
        const dbUser = await db.user.findUnique({
            where: { clerkId: clerkUserId },
            select: { id: true },
        });

        if (!dbUser) return false;

        const saved = await db.savedRecipe.findUnique({
            where: {
                userId_recipeId: {
                    userId: dbUser.id,
                    recipeId,
                },
            },
        });
        return !!saved;
    } catch (error) {
        console.error("Error checking if recipe is saved:", error);
        return false;
    }
}

/**
 * Get similar recipes for the "You can try this as well" section.
 * Finds recipes that share ingredients with the current recipe,
 * excluding the current recipe itself.
 */
export async function getSimilarRecipes(recipeId: string, limit = 4) {
    try {
        // Get the ingredient IDs of the current recipe
        const currentRecipe = await db.recipe.findUnique({
            where: { id: recipeId },
            include: {
                ingredients: { select: { ingredientId: true } },
            },
        });

        if (!currentRecipe) return [];

        const ingredientIds = currentRecipe.ingredients.map((ri) => ri.ingredientId);

        // Find recipes that share at least one ingredient
        const similar = await db.recipe.findMany({
            where: {
                id: { not: recipeId },
                ...(ingredientIds.length > 0 && {
                    ingredients: {
                        some: { ingredientId: { in: ingredientIds } },
                    },
                }),
            },
            include: {
                author: { select: { name: true, avatarUrl: true } },
                ingredients: {
                    include: { ingredient: { select: { id: true, name: true } } },
                    take: 5,
                },
                _count: { select: { savedBy: true } },
            },
            orderBy: { savedBy: { _count: "desc" } },
            take: limit,
        });

        // If we don't have enough, pad with recent popular recipes
        if (similar.length < limit) {
            const existing = similar.map((r) => r.id);
            const fallback = await db.recipe.findMany({
                where: { id: { notIn: [recipeId, ...existing] } },
                include: {
                    author: { select: { name: true, avatarUrl: true } },
                    ingredients: {
                        include: { ingredient: { select: { id: true, name: true } } },
                        take: 5,
                    },
                    _count: { select: { savedBy: true } },
                },
                orderBy: { savedBy: { _count: "desc" } },
                take: limit - similar.length,
            });
            return [...similar, ...fallback];
        }

        return similar;
    } catch (error) {
        console.error("Error fetching similar recipes:", error);
        return [];
    }
}
