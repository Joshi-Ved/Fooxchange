import { z } from "zod";

/**
 * API Request Validation Schemas
 * Protects all API endpoints from malformed/malicious input
 */

// Vision API - Image identification
export const identifyImageSchema = z.object({
    image: z.instanceof(File).refine(
        (file) => file.size <= 2 * 1024 * 1024,
        "Image must be less than 2MB"
    ).refine(
        (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
        "Only JPEG, PNG, and WebP images are allowed"
    ),
});

// AI Recommendations
export const recommendationsSchema = z.object({
    ingredients: z
        .array(z.string().min(1).max(100).trim())
        .min(1, "At least one ingredient required")
        .max(50, "Maximum 50 ingredients allowed"),
    preferences: z.object({
        dietaryRestrictions: z.array(z.string().max(50)).max(10).optional(),
        cuisinePreferences: z.array(z.string().max(50)).max(10).optional(),
        maxPrepTime: z.number().int().positive().max(1440).optional(),
        spiceLevel: z.enum(['mild', 'medium', 'spicy']).optional(),
    }).optional(),
    limit: z.number().int().min(1).max(50).default(10),
});

// Semantic Search
export const semanticSearchSchema = z.object({
    query: z.string().min(1).max(200).trim(),
    filters: z.object({
        difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
        maxPrepTime: z.number().int().positive().max(1440).optional(),
        ingredients: z.array(z.string().max(100)).max(20).optional(),
    }).optional(),
    limit: z.number().int().min(1).max(50).default(12),
});

// Recipe Analysis
export const analyzeRecipeSchema = z.object({
    recipeId: z.string().cuid("Invalid recipe ID format"),
    analysisType: z.enum(['difficulty', 'nutrition', 'tips', 'all']).default('all'),
});

// Personalized feed
export const personalizedFeedSchema = z.object({
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).default(0),
    includeReasons: z.boolean().default(false),
});

// Trending recipes
export const trendingRecipesSchema = z.object({
    limit: z.number().int().min(1).max(50).default(10),
    timeWindow: z.enum(['day', 'week', 'month', 'all']).default('week'),
});

// Generic pagination schema
export const paginationSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
});

// Generic ID schema
export const idSchema = z.object({
    id: z.string().cuid("Invalid ID format"),
});

// Export types
export type RecommendationsInput = z.infer<typeof recommendationsSchema>;
export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;
export type AnalyzeRecipeInput = z.infer<typeof analyzeRecipeSchema>;
export type PersonalizedFeedInput = z.infer<typeof personalizedFeedSchema>;
export type TrendingRecipesInput = z.infer<typeof trendingRecipesSchema>;
