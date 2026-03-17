import { z } from "zod";
import { Difficulty } from "@prisma/client";

/**
 * Recipe Creation/Edit Validation Schema
 * Ensures all recipe data is properly validated before database operations
 */
export const recipeFormSchema = z.object({
    title: z
        .string()
        .min(3, "Title must be at least 3 characters")
        .max(100, "Title must be less than 100 characters")
        .trim(),

    description: z
        .string()
        .min(10, "Description must be at least 10 characters")
        .max(500, "Description must be less than 500 characters")
        .trim(),

    imageUrl: z
        .string()
        .refine(
            (url) => {
                // Allow empty strings
                if (url === "") return true;
                // Allow relative paths (for local uploads)
                if (url.startsWith("/uploads/")) return true;
                // Allow valid absolute URLs
                try {
                    new URL(url);
                    return true;
                } catch {
                    return false;
                }
            },
            "Must be a valid image URL or uploaded file path"
        )
        .optional()
        .or(z.literal("")),

    prepTime: z
        .number()
        .int("Prep time must be a whole number")
        .min(1, "Prep time must be at least 1 minute")
        .max(1440, "Prep time must be less than 24 hours")
        .optional(),

    cookTime: z
        .number()
        .int("Cook time must be a whole number")
        .min(1, "Cook time must be at least 1 minute")
        .max(1440, "Cook time must be less than 24 hours")
        .optional(),

    servings: z
        .number()
        .int("Servings must be a whole number")
        .min(1, "Must serve at least 1 person")
        .max(100, "Servings must be less than 100")
        .default(4),

    difficulty: z.nativeEnum(Difficulty).default(Difficulty.EASY),

    // Ingredients array with amount and name
    ingredients: z
        .array(
            z.object({
                name: z.string().min(1, "Ingredient name is required").trim(),
                amount: z.string().min(1, "Amount is required").trim(),
                isOptional: z.boolean().default(false),
            })
        )
        .min(1, "At least one ingredient is required")
        .max(50, "Maximum 50 ingredients allowed"),

    // Steps array with content
    steps: z
        .array(
            z.object({
                content: z
                    .string()
                    .min(5, "Step description must be at least 5 characters")
                    .max(1000, "Step description must be less than 1000 characters")
                    .trim(),
                imageUrl: z
                    .string()
                    .refine(
                        (url) => {
                            if (url === "") return true;
                            if (url.startsWith("/uploads/")) return true;
                            try {
                                new URL(url);
                                return true;
                            } catch {
                                return false;
                            }
                        },
                        "Must be a valid image URL or uploaded file path"
                    )
                    .optional()
                    .or(z.literal("")),
            })
        )
        .min(1, "At least one step is required")
        .max(30, "Maximum 30 steps allowed"),
});

/**
 * Type inference from the schema for TypeScript
 */
export type RecipeFormData = z.infer<typeof recipeFormSchema>;

/**
 * Ingredient search/filter schema
 */
export const ingredientSearchSchema = z.object({
    query: z.string().min(1).max(100).trim(),
    limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Recipe search schema
 */
export const recipeSearchSchema = z.object({
    ingredients: z.array(z.string()).optional(),
    difficulty: z.nativeEnum(Difficulty).optional(),
    maxPrepTime: z.number().int().positive().optional(),
    query: z.string().max(200).optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(50).default(12),
});

export type RecipeSearchParams = z.infer<typeof recipeSearchSchema>;
