/**
 * Vision Service - Server-side ingredient matching
 *
 * The actual image detection runs client-side via TensorFlow.js (Edge AI).
 * This service handles:
 * 1. Matching detected item names against the ingredient database
 * 2. Logging vision analysis attempts for analytics
 *
 * @see components/camera-scanner.tsx — client-side COCO-SSD detection
 * @see lib/hooks/use-edge-vision.ts — Edge AI hook
 */

import { db } from '@/lib/db';

export interface DetectedIngredient {
    name: string;
    quantity?: string;
    confidence: number;
    unit?: string;
}

/**
 * Match detected ingredient names against the database.
 * Uses exact match first, then partial (substring) matching.
 *
 * @param detectedNames — Array of ingredient names from client-side detection
 * @returns Array of matches with match type (exact, partial, or empty)
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

        // No match — UI can suggest creating a new ingredient
        results.push({
            detected: name,
            matches: [],
        });
    }

    return results;
}

/**
 * Log vision analysis for analytics and improvement.
 * Called by API routes after client-side detection results are submitted.
 *
 * @param userId — Clerk user ID
 * @param ingredients — Array of detected ingredients from client
 * @param latencyMs — Client-side processing time
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
        console.error('[Vision Service] Failed to log analysis:', error);
    }
}
