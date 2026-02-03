/**
 * Vision API - Identify ingredients from images
 * POST /api/ai/identify
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    identifyIngredientsFromImage,
    matchIngredientsToDatabase,
} from '@/lib/services/vision-service';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for vision processing

export async function POST(req: NextRequest) {
    try {
        // Demo user for testing - TODO: Enable auth when configured
        const session = { user: { id: 'demo-user' } };

        // Check API key
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'Vision API not configured' },
                { status: 500 }
            );
        }

        // Parse form data
        const formData = await req.formData();
        const image = formData.get('image') as File;

        if (!image) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(image.type)) {
            return NextResponse.json(
                { error: 'Invalid image format. Use JPEG, PNG, or WebP' },
                { status: 400 }
            );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (image.size > maxSize) {
            return NextResponse.json(
                { error: 'Image too large. Maximum size is 5MB' },
                { status: 400 }
            );
        }

        // Convert to buffer
        const arrayBuffer = await image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Process image with vision AI
        const visionResult = await identifyIngredientsFromImage(
            buffer,
            session?.user?.id
        );

        // Match detected ingredients with database
        const ingredientNames = visionResult.ingredients.map((i) => i.name);
        const dbMatches = await matchIngredientsToDatabase(ingredientNames);

        // Combine results
        const results = visionResult.ingredients.map((detected) => {
            const match = dbMatches.find((m) => m.detected === detected.name);
            return {
                ...detected,
                databaseMatches: match?.matches || [],
            };
        });

        return NextResponse.json({
            success: true,
            ingredients: results,
            processingTime: visionResult.processingTimeMs,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Vision API error:', error);
        return NextResponse.json(
            {
                error: 'Failed to process image',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
