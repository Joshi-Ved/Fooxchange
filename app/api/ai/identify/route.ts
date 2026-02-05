/**
 * Vision API - Identify ingredients from images
 * POST /api/ai/identify
 * 
 * Security: Authentication required, rate limited, input validated
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
    identifyIngredientsFromImage,
    matchIngredientsToDatabase,
} from '@/lib/services/vision-service';
import {
    checkRateLimit,
    RateLimitPresets,
    getClientIdentifier,
    rateLimitExceededResponse
} from '@/lib/middleware/rate-limit';
import {
    handleApiError,
    authError,
    validationError,
    successResponse
} from '@/lib/utils/error-handling';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for vision processing

export async function POST(req: NextRequest) {
    try {
        // 1. Authentication check - REQUIRED
        const { userId } = await auth();

        if (!userId) {
            return authError('Please sign in to use the ingredient scanner');
        }

        // 2. Rate limiting - Prevent abuse
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, RateLimitPresets.vision);

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        // 3. Check API key configuration
        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY not configured');
            return handleApiError(
                new Error('Vision service not configured'),
                'Vision service is currently unavailable',
                503
            );
        }

        // 4. Parse and validate form data
        const formData = await req.formData();
        const image = formData.get('image') as File;

        if (!image) {
            return validationError('No image provided');
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(image.type)) {
            return validationError(
                'Invalid image format. Use JPEG, PNG, or WebP',
                { receivedType: image.type }
            );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (image.size > maxSize) {
            return validationError(
                'Image too large. Maximum size is 5MB',
                { receivedSize: `${(image.size / 1024 / 1024).toFixed(2)}MB` }
            );
        }

        // 5. Convert to buffer with timeout
        const arrayBuffer = await Promise.race([
            image.arrayBuffer(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Image processing timeout')), 10000)
            )
        ]);
        const buffer = Buffer.from(arrayBuffer);

        // 6. Process image with vision AI (with timeout)
        const visionResult = await Promise.race([
            identifyIngredientsFromImage(buffer, userId),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Vision API timeout')), 30000)
            )
        ]);

        // 7. Match detected ingredients with database
        const ingredientNames = visionResult.ingredients.map((i) => i.name);
        const dbMatches = await matchIngredientsToDatabase(ingredientNames);

        // 8. Combine results
        const results = visionResult.ingredients.map((detected) => {
            const match = dbMatches.find((m) => m.detected === detected.name);
            return {
                ...detected,
                databaseMatches: match?.matches || [],
            };
        });

        return successResponse({
            ingredients: results,
            processingTime: visionResult.processingTimeMs,
            count: results.length,
        });
    } catch (error) {
        return handleApiError(
            error,
            'Failed to process image. Please try again.',
            500
        );
    }
}

