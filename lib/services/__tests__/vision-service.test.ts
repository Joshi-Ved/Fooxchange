/**
 * Unit Tests for Vision Service
 */

import { identifyIngredientsFromImage, matchIngredientsToDatabase } from '@/lib/services/vision-service';
import { db } from '@/lib/db';

describe('Vision Service', () => {
    describe('identifyIngredientsFromImage', () => {
        it('should return empty ingredients (client-side detection is primary)', async () => {
            const mockBuffer = Buffer.from('fake-image-data');

            const result = await identifyIngredientsFromImage(mockBuffer);

            expect(result.ingredients).toHaveLength(0);
            expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('should log vision analysis when userId is provided', async () => {
            const mockBuffer = Buffer.from('fake-image-data');
            const userId = 'test-user-123';

            await identifyIngredientsFromImage(mockBuffer, userId);

            // Verify vision log was created
            expect(db.visionLog.create).toHaveBeenCalled();
        });
    });

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
});
