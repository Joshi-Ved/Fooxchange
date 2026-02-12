/**
 * Vision Service - Server-side ingredient matching
 *
 * The actual detection runs client-side via TensorFlow.js (Edge AI).
 * This service handles matching detected items with the database.
 *
 * @see components/camera-scanner.tsx for the client-side YOLO/COCO-SSD detection
 * @see lib/hooks/use-edge-vision.ts for the Edge AI hook
 */

import { db } from '@/lib/db';

export interface DetectedIngredient {
    name: string;
    quantity?: string;
    confidence: number;
    unit?: string;
}

export interface VisionAnalysisResult {
    ingredients: DetectedIngredient[];
    processingTimeMs: number;
    imageUrl?: string;
}

/**
 * Server-side fallback: Identify ingredients from image buffer
 * 
 * NOTE: Primary detection happens client-side via TensorFlow.js COCO-SSD.
 * This function is a server-side fallback that returns a message
 * directing users to use the camera scanner instead.
 * 
 * @param imageBuffer - Image buffer (JPEG, PNG, WebP)
 * @param userId - Optional user ID for logging
 * @returns Detected ingredients with confidence scores
 */
export async function identifyIngredientsFromImage(
    imageBuffer: Buffer,
    userId?: string
): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    // Client-side detection is the primary method.
    // This server fallback returns an empty result with guidance.
    const processingTimeMs = Date.now() - startTime;

    // Log the attempt
    if (userId) {
        await logVisionAnalysis(userId, [], processingTimeMs);
    }

    return {
        ingredients: [],
        processingTimeMs,
    };
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
async function logVisionAnalysis(
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

/**
 * Batch process multiple images
 * Useful for processing ingredient inventory in bulk
 */
export async function batchIdentifyIngredients(
    images: Buffer[],
    userId?: string
): Promise<VisionAnalysisResult[]> {
    const results: VisionAnalysisResult[] = [];

    for (let i = 0; i < images.length; i++) {
        console.log(`Processing image ${i + 1}/${images.length}`);

        const result = await identifyIngredientsFromImage(images[i], userId);
        results.push(result);

        // Rate limiting: wait 1 second between requests
        if (i < images.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    return results;
}
