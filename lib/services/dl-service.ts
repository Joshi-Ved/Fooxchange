/**
 * Advanced Deep Learning Service
 * 
 * Implements advanced ML/DL features:
 * - Collaborative filtering for personalization
 * - Recipe similarity using deep embeddings
 * - Trend analysis and prediction
 * - User taste profile learning
 */

import { db } from '@/lib/db';
import { generateEmbedding, cosineSimilarity } from './embedding-service';

export interface UserTasteProfile {
    favoriteIngredients: Array<{ name: string; score: number }>;
    cuisinePreferences: Array<{ cuisine: string; score: number }>;
    difficultyPreference: 'easy' | 'medium' | 'hard';
    avgCookingTime: number;
    spiceLevel: number; // 0-10
}

export interface TrendingRecipe {
    recipe: any;
    trendScore: number;
    growthRate: number;
    reason: string;
}

/**
 * Learn user's taste profile from their behavior
 * Uses collaborative filtering and pattern analysis
 */
export async function learnUserTasteProfile(userId: string): Promise<UserTasteProfile> {
    try {
        // Get user's saved recipes
        const savedRecipes = await db.savedRecipe.findMany({
            where: { userId },
            include: {
                recipe: {
                    include: {
                        ingredients: {
                            include: {
                                ingredient: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                savedAt: 'desc',
            },
            take: 50, // Last 50 saved recipes
        });

        if (savedRecipes.length === 0) {
            // Return default profile
            return getDefaultTasteProfile();
        }

        // Analyze ingredients
        const ingredientFrequency = new Map<string, number>();
        const cuisines = new Map<string, number>();
        let totalCookTime = 0;
        let totalDifficulty = 0;

        savedRecipes.forEach(({ recipe }) => {
            // Count ingredients
            recipe.ingredients.forEach(({ ingredient }) => {
                const count = ingredientFrequency.get(ingredient.name) || 0;
                ingredientFrequency.set(ingredient.name, count + 1);
            });

            // Track cooking time
            totalCookTime += (recipe.prepTime || 0) + (recipe.cookTime || 0);

            // Track difficulty
            const difficultyScore =
                recipe.difficulty === 'EASY' ? 1 : recipe.difficulty === 'MEDIUM' ? 2 : 3;
            totalDifficulty += difficultyScore;
        });

        // Extract top ingredients
        const sortedIngredients = Array.from(ingredientFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([name, count]) => ({
                name,
                score: count / savedRecipes.length,
            }));

        // Calculate preferences
        const avgDifficulty = totalDifficulty / savedRecipes.length;
        const difficultyPreference =
            avgDifficulty < 1.5 ? 'easy' : avgDifficulty < 2.5 ? 'medium' : 'hard';

        const avgCookingTime = totalCookTime / savedRecipes.length;

        return {
            favoriteIngredients: sortedIngredients,
            cuisinePreferences: Array.from(cuisines.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cuisine, count]) => ({
                    cuisine,
                    score: count / savedRecipes.length,
                })),
            difficultyPreference,
            avgCookingTime,
            spiceLevel: 5, // TODO: Implement spice detection
        };
    } catch (error) {
        console.error('Error learning taste profile:', error);
        return getDefaultTasteProfile();
    }
}

function getDefaultTasteProfile(): UserTasteProfile {
    return {
        favoriteIngredients: [],
        cuisinePreferences: [],
        difficultyPreference: 'easy',
        avgCookingTime: 30,
        spiceLevel: 5,
    };
}

/**
 * Collaborative filtering: Find users with similar tastes
 * and recommend what they liked
 */
export async function getCollaborativeRecommendations(
    userId: string,
    limit: number = 10
): Promise<any[]> {
    try {
        // Get current user's saved recipes
        const userSavedRecipes = await db.savedRecipe.findMany({
            where: { userId },
            select: { recipeId: true },
        });

        const userRecipeIds = userSavedRecipes.map((sr) => sr.recipeId);

        if (userRecipeIds.length === 0) {
            return [];
        }

        // Find other users who saved similar recipes
        const similarUsers = await db.savedRecipe.groupBy({
            by: ['userId'],
            where: {
                recipeId: {
                    in: userRecipeIds,
                },
                userId: {
                    not: userId,
                },
            },
            _count: {
                recipeId: true,
            },
            orderBy: {
                _count: {
                    recipeId: 'desc',
                },
            },
            take: 10,
        });

        const similarUserIds = similarUsers.map((su) => su.userId);

        // Get recipes saved by similar users that current user hasn't saved
        const recommendations = await db.savedRecipe.findMany({
            where: {
                userId: {
                    in: similarUserIds,
                },
                recipeId: {
                    notIn: userRecipeIds,
                },
            },
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
            take: limit * 2, // Get more to filter duplicates
        });

        // Deduplicate and score by frequency
        const recipeScores = new Map<string, { recipe: any; score: number }>();

        recommendations.forEach(({ recipe }) => {
            const existing = recipeScores.get(recipe.id);
            if (existing) {
                existing.score++;
            } else {
                recipeScores.set(recipe.id, { recipe, score: 1 });
            }
        });

        return Array.from(recipeScores.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((rs) => rs.recipe);
    } catch (error) {
        console.error('Error getting collaborative recommendations:', error);
        return [];
    }
}

/**
 * Find trending recipes using velocity algorithm
 * Considers: recent saves, time decay, and growth rate
 */
export async function getTrendingRecipes(
    timeWindowHours: number = 24,
    limit: number = 10
): Promise<TrendingRecipe[]> {
    try {
        const timeWindow = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

        // Get recent saves grouped by recipe
        const recentSaves = await db.savedRecipe.groupBy({
            by: ['recipeId'],
            where: {
                savedAt: {
                    gte: timeWindow,
                },
            },
            _count: {
                recipeId: true,
            },
            orderBy: {
                _count: {
                    recipeId: 'desc',
                },
            },
            take: limit * 2,
        });

        // Calculate trend scores
        const trendingRecipes: TrendingRecipe[] = [];

        for (const save of recentSaves) {
            // Get recipe details
            const recipe = await db.recipe.findUnique({
                where: { id: save.recipeId },
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
            });

            if (!recipe) continue;

            // Calculate velocity (saves per hour)
            const velocity = save._count.recipeId / timeWindowHours;

            // Get historical average
            const totalSaves = recipe._count.savedBy;
            const avgSavesPerHour = totalSaves / Math.max(1, getRecipeAgeHours(recipe.createdAt));

            // Calculate growth rate
            const growthRate = avgSavesPerHour > 0 ? velocity / avgSavesPerHour : velocity;

            // Trend score combines velocity and growth
            const trendScore = velocity * Math.log(1 + growthRate);

            trendingRecipes.push({
                recipe,
                trendScore,
                growthRate,
                reason: getTrendReason(velocity, growthRate),
            });
        }

        return trendingRecipes
            .sort((a, b) => b.trendScore - a.trendScore)
            .slice(0, limit);
    } catch (error) {
        console.error('Error getting trending recipes:', error);
        return [];
    }
}

function getRecipeAgeHours(createdAt: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    return diffMs / (1000 * 60 * 60);
}

function getTrendReason(velocity: number, growthRate: number): string {
    if (growthRate > 5) {
        return '🔥 Viral! This recipe is exploding in popularity';
    } else if (growthRate > 2) {
        return '📈 Rapidly trending';
    } else if (velocity > 10) {
        return '⭐ Consistently popular';
    } else {
        return '🌟 Growing interest';
    }
}

/**
 * Deep recipe similarity using embedding distance
 * More sophisticated than simple keyword matching
 */
export async function findSimilarRecipesDeep(
    recipeId: string,
    limit: number = 5
): Promise<Array<{ recipe: any; similarity: number }>> {
    try {
        // Get source recipe embedding
        const sourceEmbedding = await db.recipeEmbedding.findUnique({
            where: { recipeId },
        });

        if (!sourceEmbedding) {
            throw new Error('Recipe embedding not found');
        }

        const sourceVector = JSON.parse(sourceEmbedding.embedding) as number[];

        // Get all other recipe embeddings
        const allEmbeddings = await db.recipeEmbedding.findMany({
            where: {
                recipeId: {
                    not: recipeId,
                },
            },
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

        // Calculate similarities
        const similarities = allEmbeddings.map((emb) => {
            const vector = JSON.parse(emb.embedding) as number[];
            const similarity = cosineSimilarity(sourceVector, vector);

            return {
                recipe: emb.recipe,
                similarity,
            };
        });

        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    } catch (error) {
        console.error('Error finding similar recipes:', error);
        return [];
    }
}

/**
 * Predict which recipes a user will like
 * Combines taste profile + collaborative filtering + content similarity
 */
export async function predictUserPreferences(
    userId: string,
    candidateRecipes: any[]
): Promise<Array<{ recipe: any; predictedScore: number; confidence: number }>> {
    try {
        // Get user's taste profile
        const tasteProfile = await learnUserTasteProfile(userId);

        // Get user's saved recipe embeddings
        const userSavedRecipes = await db.savedRecipe.findMany({
            where: { userId },
            include: {
                recipe: {
                    include: {
                        recipeEmbedding: true,
                    },
                },
            },
        });

        // Calculate average user preference vector
        const userVectors = userSavedRecipes
            .filter((sr) => sr.recipe.recipeEmbedding)
            .map((sr) => JSON.parse(sr.recipe.recipeEmbedding!.embedding) as number[]);

        if (userVectors.length === 0) {
            // No history, return default scoring
            return candidateRecipes.map((recipe) => ({
                recipe,
                predictedScore: 0.5,
                confidence: 0.1,
            }));
        }

        const userPreferenceVector = averageVectors(userVectors);

        // Score each candidate
        const predictions = await Promise.all(
            candidateRecipes.map(async (recipe) => {
                // Get recipe embedding
                const recipeEmb = await db.recipeEmbedding.findUnique({
                    where: { recipeId: recipe.id },
                });

                if (!recipeEmb) {
                    return {
                        recipe,
                        predictedScore: 0.5,
                        confidence: 0.2,
                    };
                }

                const recipeVector = JSON.parse(recipeEmb.embedding) as number[];
                const similarity = cosineSimilarity(userPreferenceVector, recipeVector);

                // Adjust score based on taste profile
                let scoreAdjustment = 0;

                // Check if recipe contains favorite ingredients
                const recipeIngredientNames = recipe.ingredients.map(
                    (ri: any) => ri.ingredient.name
                );
                const favoriteMatches = tasteProfile.favoriteIngredients.filter((fi) =>
                    recipeIngredientNames.includes(fi.name)
                );
                scoreAdjustment += favoriteMatches.length * 0.05;

                // Check cooking time preference
                const recipeCookTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
                const timeDiff = Math.abs(recipeCookTime - tasteProfile.avgCookingTime);
                if (timeDiff < 15) {
                    scoreAdjustment += 0.1;
                }

                const predictedScore = Math.min(1, similarity + scoreAdjustment);
                const confidence = Math.min(
                    1,
                    userSavedRecipes.length / 20 // Confidence increases with more data
                );

                return {
                    recipe,
                    predictedScore,
                    confidence,
                };
            })
        );

        return predictions.sort((a, b) => b.predictedScore - a.predictedScore);
    } catch (error) {
        console.error('Error predicting preferences:', error);
        return candidateRecipes.map((recipe) => ({
            recipe,
            predictedScore: 0.5,
            confidence: 0.1,
        }));
    }
}

/**
 * Calculate average of multiple vectors
 */
function averageVectors(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];

    const dimensions = vectors[0].length;
    const sum = new Array(dimensions).fill(0);

    vectors.forEach((vector) => {
        vector.forEach((value, idx) => {
            sum[idx] += value;
        });
    });

    return sum.map((value) => value / vectors.length);
}
