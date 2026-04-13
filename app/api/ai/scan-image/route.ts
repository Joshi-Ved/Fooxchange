/**
 * Groq Vision Image-to-Ingredients API
 * POST /api/ai/scan-image
 *
 * Accepts a base64 image (from camera capture or file upload),
 * sends it to Groq's vision model to identify food items,
 * then generates recipe suggestions from those items.
 *
 * This is the primary AI fallback when client-side COCO-SSD
 * gives low-confidence or wrong results (e.g. "hot dog" for a carrot).
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
    checkRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();

        // Rate limit: vision calls are expensive
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, {
            maxRequests: 15,
            windowSeconds: 60,
        });
        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        const groqApiKey = process.env.GROQ_API_KEY || process.env.groq_api_key;
        if (!groqApiKey) {
            return Response.json(
                { error: 'Groq API key not configured. Add GROQ_API_KEY to .env' },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { imageBase64, mimeType = 'image/jpeg', voiceHint = '', limit = 5 } = body;

        if (!imageBase64) {
            return Response.json({ error: 'imageBase64 is required' }, { status: 400 });
        }

        // ── Step 1: Ask Groq Vision to identify food items ─────────────────────
        const systemPrompt = voiceHint
            ? `You are a food ingredient identification AI. The user mentioned: "${voiceHint}". Identify ALL food items visible in the image. Include what the user mentioned if reasonable.`
            : `You are a food ingredient identification AI. Identify ALL food items visible in this image.`;

        const visionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`,
                                },
                            },
                            {
                                type: 'text',
                                text: `${systemPrompt}

Return ONLY a raw JSON array of detected food ingredient names. No extra text.
Example: ["carrot", "tomato", "onion", "garlic"]

Be specific (e.g. "red bell pepper" not just "vegetable").
Include all visible food items, spices, and produce.`,
                            },
                        ],
                    },
                ],
                temperature: 0.1,
                max_tokens: 300,
            }),
        });

        if (!visionResponse.ok) {
            const errText = await visionResponse.text();
            console.error('[scan-image] Groq vision error:', errText);
            return Response.json({ error: 'Groq vision model failed', details: errText }, { status: 500 });
        }

        const visionData = await visionResponse.json();
        let rawContent = visionData.choices?.[0]?.message?.content || '[]';

        // Strip markdown fences if model added them
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

        let detectedIngredients: string[] = [];
        try {
            const parsed = JSON.parse(rawContent);
            detectedIngredients = Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
            // Try to extract comma-separated list as fallback
            const matches = rawContent.match(/["']([^"']+)["']/g);
            detectedIngredients = matches ? matches.map((m: string) => m.replace(/["']/g, '')) : [];
        }

        // Add voice hint items if not already detected
        if (voiceHint) {
            const hintItems = voiceHint.split(/[,\s]+/).filter((s: string) => s.length > 2);
            for (const item of hintItems) {
                if (!detectedIngredients.some((d) => d.toLowerCase().includes(item.toLowerCase()))) {
                    detectedIngredients.push(item);
                }
            }
        }

        if (detectedIngredients.length === 0) {
            return Response.json({
                data: {
                    detectedIngredients: [],
                    suggestions: [],
                    message: 'No food items detected in image',
                },
            });
        }
        return Response.json({
            data: {
                detectedIngredients,
                suggestions: [],
                source: 'groq-vision',
            },
        });
    } catch (error) {
        console.error('[scan-image] Fatal error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
