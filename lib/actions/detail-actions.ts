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

export async function toggleSaveRecipe(userId: string, recipeId: string) {
    try {
        // Check if already saved
        const existing = await db.savedRecipe.findUnique({
            where: {
                userId_recipeId: {
                    userId,
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
                    userId,
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

export async function isRecipeSaved(userId: string, recipeId: string) {
    try {
        const saved = await db.savedRecipe.findUnique({
            where: {
                userId_recipeId: {
                    userId,
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
