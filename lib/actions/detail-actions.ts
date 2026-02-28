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
