/**
 * Semantic Search Service
 * 
 * Provides vector-based semantic search functionality for recipes and ingredients.
 * This allows finding similar items based on meaning rather than exact keyword matches.
 */

import { db } from '@/lib/db';
import { generateEmbedding, cosineSimilarity } from './embedding-service';

/**
 * Search for recipes semantically similar to the query
 * 
 * @param query - Search query (e.g., "spicy comfort food" or "tomato pasta")
 * @param limit - Maximum number of results to return
 * @param threshold - Minimum similarity score (0-1) to include results
 * @returns Array of recipes sorted by relevance
 */
export async function searchRecipesBySemantic(
    query: string,
    limit: number = 10,
    threshold: number = 0.7
) {
    try {
        // Generate embedding for the search query
        const queryEmbedding = await generateEmbedding(query);

        // Fetch recipe embeddings (capped to prevent O(n) full-table scan)
        // TODO: Migrate to pgvector for true ANN search when Neon supports it
        const recipeEmbeddings = await db.recipeEmbedding.findMany({
            take: 500,
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
        });

        // Calculate similarity scores
        const results = recipeEmbeddings
            .map((re) => {
                const embedding = JSON.parse(re.embedding) as number[];
                const similarity = cosineSimilarity(queryEmbedding, embedding);

                return {
                    recipe: re.recipe,
                    similarity,
                };
            })
            .filter((result) => result.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return results;
    } catch (error) {
        console.error('Error in semantic recipe search:', error);
        throw new Error('Failed to perform semantic search');
    }
}

/**
 * Find recipes that can be made with given ingredients
 * Uses semantic matching to handle ingredient variations (e.g., "cilantro" matches "coriander")
 * 
 * @param ingredientNames - Array of ingredient names user has
 * @param minMatch - Minimum percentage of recipe ingredients that must match (0-1)
 * @param limit - Maximum number of results
 */
export async function findRecipesByIngredients(
    ingredientNames: string[],
    minMatch: number = 0.5,
    limit: number = 20
) {
    try {
        // Generate embeddings for user's ingredients
        const userEmbeddings = await Promise.all(
            ingredientNames.map((name) => generateEmbedding(name))
        );

        // Fetch recipes with their ingredients (capped to prevent full-table scan)
        const recipes = await db.recipe.findMany({
            take: 500,
            include: {
                ingredients: {
                    include: {
                        ingredient: {
                            include: {
                                ingredientEmbedding: true,
                            },
                        },
                    },
                },
                author: {
                    select: {
                        name: true,
                        avatarUrl: true,
                    },
                },
                _count: {
                    select: {
                        savedBy: true,
                    },
                },
            },
        });

        // Calculate match scores for each recipe
        const scoredRecipes = recipes
            .map((recipe) => {
                const recipeIngredients = recipe.ingredients;
                let matchedCount = 0;

                // For each recipe ingredient, check if it matches any user ingredient
                recipeIngredients.forEach((ri) => {
                    const embeddingData = ri.ingredient.ingredientEmbedding;
                    if (!embeddingData) return;

                    const ingredientEmbedding = JSON.parse(embeddingData.embedding) as number[];

                    // Check similarity with each user ingredient
                    const bestMatch = Math.max(
                        ...userEmbeddings.map((userEmb) =>
                            cosineSimilarity(userEmb, ingredientEmbedding)
                        )
                    );

                    // Consider it a match if similarity is above 0.8
                    if (bestMatch >= 0.8) {
                        matchedCount++;
                    }
                });

                const matchPercentage =
                    recipeIngredients.length > 0
                        ? matchedCount / recipeIngredients.length
                        : 0;

                return {
                    recipe,
                    matchPercentage,
                    matchedCount,
                    totalIngredients: recipeIngredients.length,
                };
            })
            .filter((result) => result.matchPercentage >= minMatch)
            .sort((a, b) => b.matchPercentage - a.matchPercentage)
            .slice(0, limit);

        return scoredRecipes;
    } catch (error) {
        console.error('Error finding recipes by ingredients:', error);
        throw new Error('Failed to find recipes');
    }
}

/**
 * Find similar ingredients (for suggestions)
 * 
 * @param ingredientName - The ingredient to find alternatives for
 * @param limit - Number of suggestions to return
 */
export async function findSimilarIngredients(
    ingredientName: string,
    limit: number = 5
) {
    try {
        const queryEmbedding = await generateEmbedding(ingredientName);

        const allIngredients = await db.ingredient.findMany({
            take: 1000,
            include: {
                ingredientEmbedding: true,
            },
        });

        const results = allIngredients
            .filter((ing) => ing.ingredientEmbedding !== null)
            .map((ing) => {
                const embedding = JSON.parse(ing.ingredientEmbedding!.embedding) as number[];
                const similarity = cosineSimilarity(queryEmbedding, embedding);

                return {
                    ingredient: ing,
                    similarity,
                };
            })
            .filter(
                (result) =>
                    result.ingredient.name.toLowerCase() !== ingredientName.toLowerCase()
            )
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return results;
    } catch (error) {
        console.error('Error finding similar ingredients:', error);
        throw new Error('Failed to find similar ingredients');
    }
}
