"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { recipeFormSchema, type RecipeFormData } from "@/lib/validations";

/**
 * Server Action: Create a new recipe
 * 
 * This action:
 * 1. Validates user authentication
 * 2. Validates form data using Zod
 * 3. Creates or finds ingredients
 * 4. Creates recipe with all relations in a transaction
 * 
 * @returns Created recipe ID or error
 */
export async function createRecipe(data: RecipeFormData) {
    try {
        // 1. Authentication check
        const { userId } = await auth();
        const user = await currentUser();

        if (!userId || !user) {
            return { error: "You must be logged in to create a recipe" };
        }

        // 2. Validate input data
        const validatedData = recipeFormSchema.parse(data);

        // 3. Check if user exists in our DB, create if not (Clerk sync)
        let dbUser = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if (!dbUser) {
            dbUser = await db.user.create({
                data: {
                    clerkId: userId,
                    email: user.emailAddresses[0]?.emailAddress ?? "",
                    name: user.fullName ?? user.firstName ?? "Anonymous Chef",
                    avatarUrl: user.imageUrl,
                },
            });
        }

        // 4. Create recipe with ingredients and steps in a transaction
        const recipe = await db.$transaction(async (tx) => {
            // Create the recipe
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

            // Create or find ingredients and link them
            for (const ing of validatedData.ingredients) {
                // Generate slug from ingredient name
                const slug = ing.name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

                // Find or create ingredient
                let ingredient = await tx.ingredient.findUnique({
                    where: { slug },
                });

                if (!ingredient) {
                    ingredient = await tx.ingredient.create({
                        data: {
                            name: ing.name,
                            slug,
                        },
                    });
                }

                // Link ingredient to recipe
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

        // 5. Revalidate relevant paths
        revalidatePath("/");
        revalidatePath("/recipes");

        return { success: true, recipeId: recipe.id };
    } catch (error) {
        console.error("Error creating recipe:", error);

        if (error instanceof Error) {
            return { error: error.message };
        }

        return { error: "Failed to create recipe. Please try again." };
    }
}

/**
 * Server Action: Get user's own recipes with pagination
 */
export async function getUserRecipes(page: number = 1, limit: number = 20) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return { error: "Unauthorized" };
        }

        // Validate pagination parameters
        const validPage = Math.max(1, Math.floor(page));
        const validLimit = Math.min(100, Math.max(1, Math.floor(limit))); // Max 100 items per page
        const skip = (validPage - 1) * validLimit;

        const dbUser = await db.user.findUnique({
            where: { clerkId: userId },
            include: {
                recipes: {
                    take: validLimit,
                    skip: skip,
                    include: {
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
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });

        if (!dbUser) {
            return { error: "User not found" };
        }

        // Get total count for pagination
        const totalCount = await db.recipe.count({
            where: { authorId: dbUser.id },
        });

        return {
            success: true,
            recipes: dbUser.recipes,
            pagination: {
                page: validPage,
                limit: validLimit,
                total: totalCount,
                hasMore: skip + dbUser.recipes.length < totalCount,
            },
        };
    } catch (error) {
        console.error("Error fetching user recipes:", error);
        return { error: "Failed to fetch recipes" };
    }
}

/**
 * Server Action: Delete a recipe (only author can delete)
 */
export async function deleteRecipe(recipeId: string) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return { error: "Unauthorized" };
        }

        const dbUser = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if (!dbUser) {
            return { error: "User not found" };
        }

        // Check if user owns this recipe
        const recipe = await db.recipe.findUnique({
            where: { id: recipeId },
        });

        if (!recipe) {
            return { error: "Recipe not found" };
        }

        if (recipe.authorId !== dbUser.id) {
            return { error: "You can only delete your own recipes" };
        }

        // Delete recipe (cascades will handle related data)
        await db.recipe.delete({
            where: { id: recipeId },
        });

        revalidatePath("/");
        revalidatePath("/recipes");

        return { success: true };
    } catch (error) {
        console.error("Error deleting recipe:", error);
        return { error: "Failed to delete recipe" };
    }
}

/**
 * Server Action: Save/Unsave a recipe
 */
export async function toggleSaveRecipe(recipeId: string) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return { error: "You must be logged in to save recipes" };
        }

        const dbUser = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if (!dbUser) {
            return { error: "User not found" };
        }

        // Check if already saved
        const existingSave = await db.savedRecipe.findUnique({
            where: {
                userId_recipeId: {
                    userId: dbUser.id,
                    recipeId,
                },
            },
        });

        if (existingSave) {
            // Unsave
            await db.savedRecipe.delete({
                where: { id: existingSave.id },
            });
            return { success: true, saved: false };
        } else {
            // Save
            await db.savedRecipe.create({
                data: {
                    userId: dbUser.id,
                    recipeId,
                },
            });
            return { success: true, saved: true };
        }
    } catch (error) {
        console.error("Error toggling save:", error);
        return { error: "Failed to save recipe" };
    }
}
