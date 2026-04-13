/**
 * Voice-to-Recipe Suggestion API
 * POST /api/ai/voice-recommend
 *
 * Accepts a natural-language voice query and returns ranked recipes.
 * Works for signed-in and signed-out users.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import {
    checkRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';

const voiceRecommendSchema = z.object({
    query: z.string().min(1).max(300),
    detectedIngredients: z.array(z.string()).optional(),
    limit: z.number().min(1).max(10).default(5),
});

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();

        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, {
            maxRequests: 30,
            windowSeconds: 60,
        });

        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit);
        }

        const body = await req.json();
        const parsed = voiceRecommendSchema.safeParse(body);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: 'Invalid query', details: parsed.error.flatten() }), { status: 400 });
        }

        const { query, detectedIngredients = [], limit } = parsed.data;

        // Use Groq API to generate custom recipes combining YOLO items + voice input
        const groqApiKey = process.env.groq_api_key || process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            return new Response(JSON.stringify({ error: 'Groq API Key missing' }), { status: 500 });
        }

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    { 
                        role: 'system', 
                        content: `You are an AI for Fooxchange. The user has detected ingredients: [${detectedIngredients.join(', ')}].
Their natural language query is: "${query}".

Identify any NEW food ingredients the user is mentioning.
Return ONLY a raw JSON array of strings containing the combined ingredients (detected + new). 
No markdown fences, no extra text.
Example: ["carrot", "tomato", "paneer"]` 
                    }
                ],
                temperature: 0.1,
            })
        });

        if (!groqResponse.ok) {
            const errBody = await groqResponse.text();
            console.error('Groq Error:', errBody);
            return new Response(JSON.stringify({ error: 'Groq failed' }), { status: 500 });
        }

        const groqData = await groqResponse.json();
        
        let extractedJson = groqData.choices?.[0]?.message?.content || "[]";
        
        // Strip markdown if it was added accidentally
        extractedJson = extractedJson.replace(/```json/g, '').replace(/```/g, '').trim();

        let extractedIngredients = [];
        try {
            extractedIngredients = JSON.parse(extractedJson);
            if (!Array.isArray(extractedIngredients)) extractedIngredients = [];
        } catch (err) {
            console.error('Failed to parse Groq response:', extractedJson);
            extractedIngredients = [];
        }

        return new Response(JSON.stringify({
            data: {
                query,
                extractedIngredients
            }
        }), { status: 200 });

    } catch (error) {
        console.error('Failed to process voice recipe query:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
