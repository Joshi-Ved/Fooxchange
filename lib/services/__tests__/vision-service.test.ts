/**
 * Unit Tests for Vision Service
 */

import { matchIngredientsToDatabase, logVisionAnalysis } from '@/lib/services/vision-service';
import { db } from '@/lib/db';

describe('Vision Service', () => {
    describe('matchIngredientsToDatabase', () => {
        it('should find exact matches in database', async () => {
            const mockIngredient = {
                id: '1',
                name: 'Tomato',
                category: 'vegetable',
                slug: 'tomato',
                createdAt: new Date(),
            };

            (db.ingredient.findFirst as jest.Mock).mockResolvedValueOnce(mockIngredient);

            const results = await matchIngredientsToDatabase(['Tomato']);

            expect(results[0].detected).toBe('Tomato');
            expect(results[0].matches[0]).toMatchObject({
                ...mockIngredient,
                matchType: 'exact',
            });
        });

        it('should find partial matches when exact match fails', async () => {
            const mockIngredients = [
                { id: '1', name: 'Cherry Tomato', category: 'vegetable', slug: 'cherry-tomato', createdAt: new Date() },
                { id: '2', name: 'Tomato Paste', category: 'condiment', slug: 'tomato-paste', createdAt: new Date() },
            ];

            (db.ingredient.findFirst as jest.Mock).mockResolvedValueOnce(null);
            (db.ingredient.findMany as jest.Mock).mockResolvedValueOnce(mockIngredients);

            const results = await matchIngredientsToDatabase(['Tomato']);

            expect(results[0].matches).toHaveLength(2);
            expect(results[0].matches[0].matchType).toBe('partial');
        });

        it('should return empty matches when ingredient not found', async () => {
            (db.ingredient.findFirst as jest.Mock).mockResolvedValueOnce(null);
            (db.ingredient.findMany as jest.Mock).mockResolvedValueOnce([]);

            const results = await matchIngredientsToDatabase(['UnknownIngredient']);

            expect(results[0].matches).toHaveLength(0);
        });
    });

    describe('logVisionAnalysis', () => {
        it('should log vision analysis to database', async () => {
            const userId = 'test-user-123';
            const ingredients = [
                { name: 'Tomato', confidence: 0.95 },
                { name: 'Onion', confidence: 0.88 },
            ];

            await logVisionAnalysis(userId, ingredients, 150);

            expect(db.visionLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId,
                    detectedItems: ingredients,
                    latencyMs: 150,
                }),
            });
        });

        it('should not throw on logging failure', async () => {
            (db.visionLog.create as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

            // Should not throw
            await expect(
                logVisionAnalysis('user-123', [], 100)
            ).resolves.toBeUndefined();
        });
    });
});
