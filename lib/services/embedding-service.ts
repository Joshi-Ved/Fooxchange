/**
 * Embedding Service
 * 
 * Handles generating vector embeddings for recipes and ingredients
 * using OpenAI's text-embedding-3-small model.
 * 
 * Vector embeddings allow semantic search - finding similar items
 * based on meaning rather than exact keyword matches.
 */

import OpenAI from 'openai';

// Initialize OpenAI client
// API key should be in environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding vector for text
 * 
 * @param text - The text to embed (ingredient name, recipe description, etc.)
 * @returns Array of 1536 floats representing the semantic meaning
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty for embedding generation');
        }

        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text.trim(),
            encoding_format: 'float',
        });

        if (!response.data || response.data.length === 0) {
            throw new Error('No embedding returned from OpenAI');
        }

        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw new Error(
            `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Generate embedding for an ingredient
 * Combines the ingredient name with its category for better semantic representation
 * 
 * @param name - Ingredient name (e.g., "Tomato")
 * @param category - Optional category (e.g., "Vegetable")
 */
export async function generateIngredientEmbedding(
    name: string,
    category?: string | null
): Promise<number[]> {
    // Combine name and category for richer embedding
    const text = category ? `${name} (${category})` : name;
    return generateEmbedding(text);
}

/**
 * Generate embedding for a recipe
 * Combines title, description, and ingredients for comprehensive representation
 * 
 * @param title - Recipe title
 * @param description - Recipe description
 * @param ingredients - Array of ingredient names
 */
export async function generateRecipeEmbedding(
    title: string,
    description: string,
    ingredients: string[]
): Promise<number[]> {
    // Create a rich text representation of the recipe
    const ingredientList = ingredients.join(', ');
    const text = `${title}. ${description}. Ingredients: ${ingredientList}`;

    return generateEmbedding(text);
}

/**
 * Calculate cosine similarity between two vectors
 * Used to find how similar two embeddings are (0 = different, 1 = identical)
 * 
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (normA * normB);
}

/**
 * Batch generate embeddings with rate limiting
 * OpenAI has rate limits, so we process in batches with delays
 * 
 * @param texts - Array of texts to embed
 * @param batchSize - Number of texts to process at once
 * @param delayMs - Delay between batches in milliseconds
 */
export async function batchGenerateEmbeddings(
    texts: string[],
    batchSize: number = 100,
    delayMs: number = 1000
): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(texts.length / batchSize)}`);

        // Process batch concurrently
        const batchResults = await Promise.all(
            batch.map((text) => generateEmbedding(text))
        );

        embeddings.push(...batchResults);

        // Delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    return embeddings;
}
