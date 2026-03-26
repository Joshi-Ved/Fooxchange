"use server";

import { db } from "@/lib/db";
import { Difficulty, Prisma } from "@prisma/client";

export type RecipeCard = {
    id: string;
    title: string;
    description: string;
    imageUrl: string | null;
    prepTime: number | null;
    cookTime: number | null;
    difficulty: Difficulty;
    author: {
        name: string;
        avatarUrl: string | null;
    };
    ingredients: {
        name: string;
    }[];
    _count: {
        savedBy: number;
    };
    createdAt: Date;
};

function isDatabaseUnavailable(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientInitializationError) {
        return true;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return error.code === "P1001";
    }

    if (error instanceof Error) {
        return (
            error.message.includes("Can't reach database server") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("P1001")
        );
    }

    return false;
}

function logFeedActionError(action: string, error: unknown) {
    if (isDatabaseUnavailable(error)) {
        console.warn(`[feed-actions] ${action}: database unavailable, returning empty result`);
        return;
    }

    console.error(`[feed-actions] ${action} failed:`, error);
}

export async function getRecipes(options?: {
    ingredients?: string[];
    difficulty?: Difficulty;
    limit?: number;
    offset?: number;
}): Promise<RecipeCard[]> {
    const { ingredients, difficulty, limit = 12, offset = 0 } = options || {};

    try {
        const recipes = await db.recipe.findMany({
            where: {
                ...(difficulty && { difficulty }),
                ...(ingredients &&
                    ingredients.length > 0 && {
                    ingredients: {
                        some: {
                            ingredient: {
                                slug: {
                                    in: ingredients.map((i) => i.toLowerCase()),
                                },
                            },
                        },
                    },
                }),
            },
            include: {
                author: {
                    select: {
                        name: true,
                        avatarUrl: true,
                    },
                },
                ingredients: {
                    include: {
                        ingredient: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    take: 5, // Show first 5 ingredients on card
                },
                _count: {
                    select: {
                        savedBy: true, // Like count
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
            skip: offset,
        });

        // Transform to match RecipeCard type
        return recipes.map((recipe) => ({
            ...recipe,
            ingredients: recipe.ingredients.map((ri) => ({
                name: ri.ingredient.name,
            })),
        }));
    } catch (error) {
        logFeedActionError("getRecipes", error);
        return [];
    }
}

export async function searchRecipesByIngredients(
    ingredientNames: string[]
): Promise<RecipeCard[]> {
    if (!ingredientNames || ingredientNames.length === 0) {
        return getRecipes();
    }

    try {
        // Normalize ingredient names
        const normalizedIngredients = ingredientNames.map((i) =>
            i.toLowerCase().trim()
        );

        const recipes = await db.recipe.findMany({
            where: {
                ingredients: {
                    some: {
                        ingredient: {
                            OR: normalizedIngredients.map((name) => ({
                                name: {
                                    contains: name,
                                    mode: "insensitive" as const,
                                },
                            })),
                        },
                    },
                },
            },
            include: {
                author: {
                    select: {
                        name: true,
                        avatarUrl: true,
                    },
                },
                ingredients: {
                    include: {
                        ingredient: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        savedBy: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return recipes.map((recipe) => ({
            ...recipe,
            ingredients: recipe.ingredients.map((ri) => ({
                name: ri.ingredient.name,
            })),
        }));
    } catch (error) {
        logFeedActionError("searchRecipesByIngredients", error);
        return [];
    }
}

/**
 * Get the latest recipes, sorted by creation date.
 * Note: Named "trending" but actually returns newest recipes (MED-37).
 * True trending would require a metrics/analytics table tracking views/saves over time.
 */
export async function getTrendingRecipes(limit = 6): Promise<RecipeCard[]> {
    try {
        const recipes = await db.recipe.findMany({
            include: {
                author: {
                    select: {
                        name: true,
                        avatarUrl: true,
                    },
                },
                ingredients: {
                    include: {
                        ingredient: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    take: 5,
                },
                _count: {
                    select: {
                        savedBy: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc", // PERFORMANCE FIX: Changed from savedBy._count which was extremely slow
            },
            take: limit,
        });

        return recipes.map((recipe) => ({
            ...recipe,
            ingredients: recipe.ingredients.map((ri) => ({
                name: ri.ingredient.name,
            })),
        }));
    } catch (error) {
        logFeedActionError("getTrendingRecipes", error);
        return [];
    }
}
