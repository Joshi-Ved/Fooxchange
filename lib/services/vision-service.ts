/**
 * Vision Service (Server-side)
 * 
 * Provides database matching and logging for ingredient detection.
 * Note: Actual image analysis has moved to client-side Edge AI (lib/ai/edge-vision.ts).
 */

import { db } from '@/lib/db';

export interface DetectedIngredient {
    name: string;
    quantity?: string;
    confidence: number;
    unit?: string;
}

/**
 * Match detected ingredients with database entries
 * Uses fuzzy matching to handle variations in naming
 * 
 * @param detectedNames - Array of ingredient names from vision API
 * @returns Array of matched database ingredients with suggestions
 */
export async function matchIngredientsToDatabase(
    detectedNames: string[]
): Promise<Array<{ detected: string; matches: any[] }>> {
    const results = [];

    for (const name of detectedNames) {
        // Try exact match first (case-insensitive)
        const exactMatch = await db.ingredient.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
            },
        });

        if (exactMatch) {
            results.push({
                detected: name,
                matches: [{ ...exactMatch, matchType: 'exact' }],
            });
            continue;
        }

        // Try partial match
        const partialMatches = await db.ingredient.findMany({
            where: {
                name: {
                    contains: name,
                    mode: 'insensitive',
                },
            },
            take: 3,
        });

        if (partialMatches.length > 0) {
            results.push({
                detected: name,
                matches: partialMatches.map((m) => ({ ...m, matchType: 'partial' })),
            });
            continue;
        }

        // No match - suggest creating new ingredient
        results.push({
            detected: name,
            matches: [],
        });
    }

    return results;
}

/**
 * Log vision analysis for analytics and improvement
 */
export async function logVisionAnalysis(
    userId: string,
    ingredients: DetectedIngredient[],
    latencyMs: number
): Promise<void> {
    try {
        await db.visionLog.create({
            data: {
                userId,
                detectedItems: ingredients as any, // Prisma Json type
                latencyMs,
                createdAt: new Date(),
            },
        });
    } catch (error) {
        // Logging failure shouldn't break the main flow
        console.error('Failed to log vision analysis:', error);
    }
}
