/**
 * Unit Tests for ML Service
 */

import {
    getIntelligentRecommendations,
    predictCookingDifficulty,
    estimateNutrition,
    generateCookingTips,
} from '@/lib/services/ml-service';
import { db } from '@/lib/db';
import * as embeddingService from '@/lib/services/embedding-service';

// Embedding service mock
jest.mock('@/lib/services/embedding-service');

// Use 384-dim vectors to match Edge AI model (all-MiniLM-L6-v2)
const MOCK_EMBEDDING_DIM = 384;
const mockEmbedding = () => Array(MOCK_EMBEDDING_DIM).fill(0.1);

describe('ML Service', () => {
    describe('predictCookingDifficulty', () => {
        it('should predict easy difficulty for simple recipes', () => {
            const simpleRecipe = {
                title: 'Simple Salad',
                ingredients: [
                    { ingredient: { name: 'Lettuce' } },
                    { ingredient: { name: 'Tomato' } },
                ],
                prepTime: 10,
                cookTime: 0,
                instructions: ['Chop lettuce', 'Add tomato', 'Done'],
            };

            const result = predictCookingDifficulty(simpleRecipe);

            expect(result.level).toBe('easy');
            expect(result.confidence).toBeGreaterThan(0.7);
            expect(result.factors).toEqual([]);
        });

        it('should predict hard difficulty for complex recipes', () => {
            const complexRecipe = {
                title: 'Beef Wellington',
                ingredients: Array(20).fill({ ingredient: { name: 'Ingredient' } }),
                prepTime: 60,
                cookTime: 90,
                instructions: Array(15).fill('Complex step').map((s, i) => `${s} ${i + 1}`),
            };
            complexRecipe.instructions.push('Sous vide the beef');

            const result = predictCookingDifficulty(complexRecipe);

            expect(result.level).toBe('hard');
            expect(result.confidence).toBeGreaterThan(0.7);
            expect(result.factors.length).toBeGreaterThan(0);
        });

        it('should detect advanced cooking techniques', () => {
            const recipe = {
                title: 'Advanced Dish',
                ingredients: [],
                prepTime: 30,
                cookTime: 30,
                instructions: ['Flambe the dish', 'Braise the meat', 'Create a reduction'],
            };

            const result = predictCookingDifficulty(recipe);

            expect(result.factors).toContain(expect.stringContaining('Advanced techniques'));
            expect(result.level).not.toBe('easy');
        });
    });

    describe('getIntelligentRecommendations', () => {
        beforeEach(() => {
            // Mock embedding generation — 384-dim to match MiniLM
            (embeddingService.generateEmbedding as jest.Mock).mockResolvedValue(
                mockEmbedding()
            );

            // Mock cosine similarity
            (embeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.85);
        });

        it('should return recommendations based on ingredients and preferences', async () => {
            const mockRecipes = [
                {
                    id: '1',
                    title: 'Chicken Rice',
                    prepTime: 25,
                    cookTime: 30,
                    tags: [],
                    embedding: JSON.stringify(mockEmbedding()),
                    recipe: {
                        id: '1',
                        title: 'Chicken Rice',
                        description: 'Delicious chicken rice',
                        prepTime: 25,
                        cookTime: 30,
                        author: { name: 'Chef John', avatarUrl: null },
                        ingredients: [],
                        _count: { savedBy: 50 },
                    },
                },
            ];

            (db.recipe.findMany as jest.Mock).mockResolvedValue([]);
            (db.recipeEmbedding.findMany as jest.Mock).mockResolvedValue(mockRecipes);

            const result = await getIntelligentRecommendations(
                'user-123',
                ['chicken', 'rice'],
                { availableTime: 60, spiceLevel: 'mild' },
                5
            );

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should filter recipes based on dietary restrictions', async () => {
            const mockRecipes = [
                {
                    id: '1',
                    embedding: JSON.stringify(mockEmbedding()),
                    recipe: {
                        id: '1',
                        title: 'Beef Stew',
                        prepTime: 30,
                        cookTime: 60,
                        tags: ['meat'],
                        author: {},
                        ingredients: [],
                        _count: { savedBy: 10 },
                    },
                },
            ];

            (db.recipe.findMany as jest.Mock).mockResolvedValue([]);
            (db.recipeEmbedding.findMany as jest.Mock).mockResolvedValue(mockRecipes);
            (embeddingService.generateEmbedding as jest.Mock).mockResolvedValue(mockEmbedding());

            const result = await getIntelligentRecommendations(
                'user-123',
                ['vegetables'],
                { dietaryRestrictions: ['vegetarian'] },
                5
            );

            // Should filter out meat recipes
            const hasMeatRecipe = result.some(r => r.recipe.tags?.includes('meat'));
            expect(hasMeatRecipe).toBe(false);
        });
    });

    describe('estimateNutrition', () => {
        it('should return nutrition estimates from heuristic rules', async () => {
            const recipe = {
                title: 'Test Recipe',
                servings: 4,
                ingredients: [],
            };

            const result = await estimateNutrition(recipe);

            expect(result).toHaveProperty('calories');
            expect(result).toHaveProperty('protein');
            expect(result).toHaveProperty('carbs');
            expect(result).toHaveProperty('fat');
            expect(result).toHaveProperty('confidence');
        });
    });

    describe('generateCookingTips', () => {
        it('should return an array of tips', () => {
            const recipe = {
                title: 'Pasta Carbonara',
                description: 'Classic Italian pasta',
            };

            const result = generateCookingTips(recipe);

            expect(Array.isArray(result)).toBe(true);
        });
    });
});
