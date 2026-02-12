/**
 * ML Service - Machine Learning Features
 *
 * Provides intelligent recipe recommendations, nutritional analysis,
 * cooking time predictions, and personalized suggestions.
 *
 * All features work locally without external API keys.
 */

import { db } from '@/lib/db';
import { generateEmbedding, cosineSimilarity } from './embedding-service';

export interface UserPreferences {
    dietaryRestrictions?: string[];
    cuisinePreferences?: string[];
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    availableTime?: number; // minutes
    spiceLevel?: 'mild' | 'medium' | 'spicy';
}

export interface IntelligentRecommendation {
    recipe: any;
    score: number;
    reason: string;
    category: 'quick' | 'healthy' | 'comfort' | 'gourmet';
}

/**
 * Get AI-powered recipe recommendations based on user context
 * Uses hybrid approach: Vector similarity + LLM reasoning
 */
export async function getIntelligentRecommendations(
    userId: string,
    ingredients: string[],
    preferences: UserPreferences,
    limit: number = 5
): Promise<IntelligentRecommendation[]> {
    try {
        // Step 1: Get user's historical preferences
        const userHistory = await db.recipe.findMany({
            where: {
                savedBy: {
                    some: {
                        userId,
                    },
                },
            },
            include: {
                ingredients: {
                    include: {
                        ingredient: true,
                    },
                },
                recipeEmbedding: true,
            },
            take: 20,
        });

        // Step 2: Create context-aware query
        const contextQuery = buildContextQuery(ingredients, preferences, userHistory);

        // Step 3: Generate embedding for the context
        const queryEmbedding = await generateEmbedding(contextQuery);

        // Step 4: Find semantically similar recipes
        const recipeEmbeddings = await db.recipeEmbedding.findMany({
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

        // Step 5: Calculate similarity scores
        const scoredRecipes = recipeEmbeddings.map((re) => {
            const embedding = JSON.parse(re.embedding) as number[];
            const similarity = cosineSimilarity(queryEmbedding, embedding);

            return {
                recipe: re.recipe,
                similarity,
            };
        });

        // Step 6: Apply ML-based filtering and ranking
        const filtered = await applyIntelligentFiltering(
            scoredRecipes,
            ingredients,
            preferences
        );

        // Step 7: Categorize and explain recommendations
        const recommendations = await categorizeRecommendations(
            filtered.slice(0, limit),
            preferences
        );

        return recommendations;
    } catch (error) {
        console.error('Error getting intelligent recommendations:', error);
        throw new Error('Failed to generate recommendations');
    }
}

/**
 * Build context-aware search query
 */
function buildContextQuery(
    ingredients: string[],
    preferences: UserPreferences,
    history: any[]
): string {
    const parts = [];

    // Add ingredients
    if (ingredients.length > 0) {
        parts.push(`Ingredients: ${ingredients.join(', ')}`);
    }

    // Add preferences
    if (preferences.availableTime) {
        parts.push(`Quick recipe under ${preferences.availableTime} minutes`);
    }

    if (preferences.spiceLevel) {
        parts.push(`${preferences.spiceLevel} spice level`);
    }

    if (preferences.cuisinePreferences && preferences.cuisinePreferences.length > 0) {
        parts.push(`Cuisine: ${preferences.cuisinePreferences.join(', ')}`);
    }

    if (preferences.dietaryRestrictions && preferences.dietaryRestrictions.length > 0) {
        parts.push(`Dietary: ${preferences.dietaryRestrictions.join(', ')}`);
    }

    return parts.join('. ');
}

/**
 * Apply intelligent filtering based on user preferences
 */
async function applyIntelligentFiltering(
    recipes: Array<{ recipe: any; similarity: number }>,
    ingredients: string[],
    preferences: UserPreferences
) {
    return recipes
        .filter((r) => {
            // Filter by cooking time
            if (preferences.availableTime) {
                const totalTime = (r.recipe.prepTime || 0) + (r.recipe.cookTime || 0);
                if (totalTime > preferences.availableTime) return false;
            }

            // Filter by dietary restrictions
            if (preferences.dietaryRestrictions) {
                // Check if recipe tags include dietary restrictions
                const recipeTags = r.recipe.tags || [];
                const hasRestrictionViolation = preferences.dietaryRestrictions.some(
                    (restriction) => {
                        if (restriction === 'vegetarian' && recipeTags.includes('meat')) {
                            return true;
                        }
                        if (restriction === 'vegan' &&
                            (recipeTags.includes('dairy') || recipeTags.includes('eggs'))) {
                            return true;
                        }
                        return false;
                    }
                );
                if (hasRestrictionViolation) return false;
            }

            return true;
        })
        .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Categorize recommendations with AI explanation
 */
async function categorizeRecommendations(
    recipes: Array<{ recipe: any; similarity: number }>,
    preferences: UserPreferences
): Promise<IntelligentRecommendation[]> {
    const categories: Array<'quick' | 'healthy' | 'comfort' | 'gourmet'> = [
        'quick',
        'healthy',
        'comfort',
        'gourmet',
    ];

    const recommendations: IntelligentRecommendation[] = [];

    for (const { recipe, similarity } of recipes) {
        // Determine category based on recipe characteristics
        let category: 'quick' | 'healthy' | 'comfort' | 'gourmet' = 'comfort';
        let reason = '';

        const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

        if (totalTime <= 30) {
            category = 'quick';
            reason = `Quick ${totalTime}-minute meal perfect for busy days`;
        } else if (recipe.tags?.includes('healthy') || recipe.tags?.includes('light')) {
            category = 'healthy';
            reason = 'Nutritious and balanced meal';
        } else if (recipe.difficulty === 'hard' || recipe.tags?.includes('gourmet')) {
            category = 'gourmet';
            reason = 'Impressive gourmet dish to showcase your skills';
        } else {
            category = 'comfort';
            reason = 'Comforting and satisfying meal';
        }

        recommendations.push({
            recipe,
            score: similarity,
            reason,
            category,
        });
    }

    return recommendations;
}

/**
 * Predict cooking difficulty using ML heuristics
 */
export function predictCookingDifficulty(recipe: any): {
    level: 'easy' | 'medium' | 'hard';
    confidence: number;
    factors: string[];
} {
    const factors: string[] = [];
    let difficultyScore = 0;

    // Factor 1: Number of ingredients
    const ingredientCount = recipe.ingredients?.length || 0;
    if (ingredientCount > 15) {
        difficultyScore += 2;
        factors.push('Many ingredients required');
    } else if (ingredientCount > 8) {
        difficultyScore += 1;
    }

    // Factor 2: Cooking time
    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    if (totalTime > 90) {
        difficultyScore += 2;
        factors.push('Time-intensive preparation');
    } else if (totalTime > 45) {
        difficultyScore += 1;
    }

    // Factor 3: Number of steps
    const steps = recipe.instructions?.length || 0;
    if (steps > 10) {
        difficultyScore += 2;
        factors.push('Multiple cooking steps');
    } else if (steps > 6) {
        difficultyScore += 1;
    }

    // Factor 4: Technique keywords
    const instructions = (recipe.instructions || []).join(' ').toLowerCase();
    const advancedTechniques = ['sous vide', 'flambe', 'confit', 'braise', 'reduction'];
    const foundTechniques = advancedTechniques.filter((tech) =>
        instructions.includes(tech)
    );
    if (foundTechniques.length > 0) {
        difficultyScore += foundTechniques.length;
        factors.push(`Advanced techniques: ${foundTechniques.join(', ')}`);
    }

    // Determine level
    let level: 'easy' | 'medium' | 'hard';
    let confidence: number;

    if (difficultyScore <= 2) {
        level = 'easy';
        confidence = 0.85;
    } else if (difficultyScore <= 5) {
        level = 'medium';
        confidence = 0.80;
    } else {
        level = 'hard';
        confidence = 0.88;
    }

    return { level, confidence, factors };
}

/**
 * Estimate nutritional information using heuristic rules
 * Falls back to heuristic estimation when no AI API is available
 */
export async function estimateNutrition(recipe: any): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence: number;
}> {
    // Heuristic-based estimation (works without API keys)
    const ingredientCount = recipe.ingredients?.length || 0;
    const servings = recipe.servings || 4;

    // Common nutritional patterns per ingredient type
    const nutritionEstimates: Record<string, { cal: number; protein: number; carbs: number; fat: number }> = {
        chicken: { cal: 165, protein: 31, carbs: 0, fat: 3.6 },
        beef: { cal: 250, protein: 26, carbs: 0, fat: 15 },
        rice: { cal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
        pasta: { cal: 131, protein: 5, carbs: 25, fat: 1.1 },
        potato: { cal: 77, protein: 2, carbs: 17, fat: 0.1 },
        tomato: { cal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
        onion: { cal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
        garlic: { cal: 5, protein: 0.2, carbs: 1, fat: 0 },
        oil: { cal: 120, protein: 0, carbs: 0, fat: 14 },
        butter: { cal: 102, protein: 0.1, carbs: 0, fat: 11.5 },
        egg: { cal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
        milk: { cal: 42, protein: 3.4, carbs: 5, fat: 1 },
        cheese: { cal: 113, protein: 7, carbs: 0.4, fat: 9 },
        bread: { cal: 75, protein: 2.7, carbs: 14, fat: 1 },
        sugar: { cal: 49, protein: 0, carbs: 13, fat: 0 },
        flour: { cal: 57, protein: 1.6, carbs: 12, fat: 0.2 },
        spinach: { cal: 7, protein: 0.9, carbs: 1.1, fat: 0.1 },
        paneer: { cal: 265, protein: 18, carbs: 3.6, fat: 20 },
    };

    let totalCal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    let matchedCount = 0;

    const ingredients = recipe.ingredients || [];
    ingredients.forEach((ri: any) => {
        const name = (ri.ingredient?.name || ri.name || '').toLowerCase();
        for (const [key, vals] of Object.entries(nutritionEstimates)) {
            if (name.includes(key)) {
                totalCal += vals.cal;
                totalProtein += vals.protein;
                totalCarbs += vals.carbs;
                totalFat += vals.fat;
                matchedCount++;
                break;
            }
        }
    });

    // If no matches, estimate based on ingredient count
    if (matchedCount === 0) {
        totalCal = ingredientCount * 80;
        totalProtein = ingredientCount * 3;
        totalCarbs = ingredientCount * 10;
        totalFat = ingredientCount * 3;
    }

    // Per serving
    const perServing = servings > 0 ? servings : 1;
    const confidence = matchedCount > 0 ? Math.min(0.7, matchedCount / ingredientCount) : 0.2;

    return {
        calories: Math.round(totalCal / perServing),
        protein: Math.round(totalProtein / perServing),
        carbs: Math.round(totalCarbs / perServing),
        fat: Math.round(totalFat / perServing),
        confidence: Math.round(confidence * 100) / 100,
    };
}

/**
 * Generate cooking tips using heuristic rules
 * Works without any API keys
 */
export function generateCookingTips(recipe: any): string[] {
    const tips: string[] = [];
    const ingredients = recipe.ingredients || [];
    const ingredientNames = ingredients.map((ri: any) =>
        (ri.ingredient?.name || ri.name || '').toLowerCase()
    );
    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

    // Prep all ingredients before starting
    tips.push('Read through all steps before starting and prep your ingredients (mise en place).');

    // Time-based tips
    if (totalTime > 60) {
        tips.push('This recipe takes a while - plan ahead and consider prepping ingredients in advance.');
    }
    if (totalTime <= 30) {
        tips.push('This is a quick recipe! Have all ingredients measured and ready before you start cooking.');
    }

    // Ingredient-based tips
    if (ingredientNames.some((n: string) => n.includes('garlic'))) {
        tips.push('Don\'t burn the garlic - add it after other aromatics and cook just until fragrant.');
    }
    if (ingredientNames.some((n: string) => n.includes('onion'))) {
        tips.push('Cook onions on medium heat until translucent for the best flavor base.');
    }
    if (ingredientNames.some((n: string) => n.includes('chicken') || n.includes('meat') || n.includes('beef'))) {
        tips.push('Let meat come to room temperature before cooking for more even results.');
        tips.push('Use a meat thermometer to ensure safe internal temperature.');
    }
    if (ingredientNames.some((n: string) => n.includes('pasta') || n.includes('noodle'))) {
        tips.push('Salt your pasta water generously - it should taste like the sea.');
        tips.push('Save some pasta water before draining to adjust sauce consistency.');
    }
    if (ingredientNames.some((n: string) => n.includes('rice'))) {
        tips.push('Rinse rice under cold water until water runs clear for fluffier results.');
    }
    if (ingredientNames.some((n: string) => n.includes('paneer'))) {
        tips.push('Soak paneer in warm water for 10 minutes before cooking for a softer texture.');
    }
    if (ingredientNames.some((n: string) => n.includes('egg'))) {
        tips.push('Use room temperature eggs for more consistent cooking results.');
    }

    // Difficulty-based tips
    if (recipe.difficulty === 'HARD') {
        tips.push('Take your time with each step - precision matters for this recipe.');
    }

    // General tip
    tips.push('Taste as you go and adjust seasoning - your palate is the best guide.');

    // Return 3-5 tips max
    return tips.slice(0, 5);
}
