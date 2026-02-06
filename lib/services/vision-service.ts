/**
 * Vision Service (DEPRECATED - Use Edge AI instead per PLAN3.md)
 *
 * Legacy cloud-based vision using Google Gemini Flash 1.5.
 * Migrating to client-side TensorFlow.js for zero-cost, privacy-first approach.
 *
 * @deprecated Use lib/hooks/use-edge-vision.ts for new integrations
 */

// Optional Gemini import (for backward compatibility during migration)
let genAI: any = null;
try {
    if (process.env.GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
} catch (error) {
    console.warn('[Vision Service] Gemini AI not available. Use Edge AI (lib/hooks/use-edge-vision.ts) instead.');
}

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
 * Analyze image and detect food ingredients
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

    try {
        // Initialize the model
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Convert buffer to base64
        const base64Image = imageBuffer.toString('base64');

        // Create the prompt
        const prompt = `Analyze this image and identify all raw food ingredients visible. 
        
Rules:
1. Only identify RAW ingredients (vegetables, fruits, spices, meats, grains, etc.)
2. Ignore processed/cooked foods, plates, utensils, or backgrounds
3. Provide quantity estimates when visible
4. Rate your confidence (0.0 to 1.0) for each item

Return ONLY a valid JSON array in this exact format:
[
    {
        "name": "Tomato",
        "quantity": "3",
        "unit": "pieces",
        "confidence": 0.95
    },
    {
        "name": "Garlic",
        "quantity": "5",
        "unit": "cloves",
        "confidence": 0.87
    }
]

Do not include any explanatory text, only the JSON array.`;

        // Generate content with image
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: 'image/jpeg',
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        // Parse the JSON response
        let detectedIngredients: DetectedIngredient[] = [];

        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                detectedIngredients = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON array found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse Gemini response:', text);
            throw new Error('Invalid response format from vision model');
        }

        const processingTimeMs = Date.now() - startTime;

        // Log the vision analysis (optional - for analytics)
        if (userId) {
            await logVisionAnalysis(userId, detectedIngredients, processingTimeMs);
        }

        return {
            ingredients: detectedIngredients,
            processingTimeMs,
        };
    } catch (error) {
        console.error('Vision API error:', error);
        throw new Error(
            `Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
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
