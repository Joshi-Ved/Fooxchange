/**
 * ML Service - Advanced Machine Learning Features
 * 
 * Provides intelligent recipe recommendations, nutritional analysis,
 * cooking time predictions, and personalized suggestions.
 */

import { db } from '@/lib/db';
import { generateEmbedding, cosineSimilarity } from './embedding-service';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
 * Estimate nutritional information using AI
 */
export async function estimateNutrition(recipe: any): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence: number;
}> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const ingredients = recipe.ingredients
            ?.map((ri: any) => `${ri.quantity} ${ri.unit || ''} ${ri.ingredient.name}`)
            .join('\n') || '';

        const servings = recipe.servings || 4;

        const prompt = `Estimate the nutritional information per serving for this recipe:

Recipe: ${recipe.title}
Servings: ${servings}

Ingredients:
${ingredients}

Return ONLY a JSON object with this exact format:
{
    "calories": 450,
    "protein": 25,
    "carbs": 40,
    "fat": 15,
    "confidence": 0.75
}

All values should be numbers (grams for protein/carbs/fat). Confidence should be 0.0 to 1.0.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const nutrition = JSON.parse(jsonMatch[0]);
            return nutrition;
        }

        throw new Error('Invalid nutrition response');
    } catch (error) {
        console.error('Nutrition estimation error:', error);
        // Return default values
        return {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            confidence: 0,
        };
    }
}

/**
 * Generate cooking tips using AI
 */
export async function generateCookingTips(recipe: any): Promise<string[]> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Generate 3-5 practical cooking tips for this recipe:

Recipe: ${recipe.title}
Description: ${recipe.description}

Return ONLY a JSON array of strings:
["Tip 1", "Tip 2", "Tip 3"]

Make tips actionable, concise, and helpful for home cooks.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return [];
    } catch (error) {
        console.error('Tip generation error:', error);
        return [];
    }
}
