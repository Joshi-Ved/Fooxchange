/**
 * Embedding Service — Edge-First Architecture
 *
 * Server-side embedding generation using Transformers.js (all-MiniLM-L6-v2).
 * Produces 384-dimensional vectors, identical to the client-side Edge Search hook.
 *
 * Zero-cost: no external API keys required.
 * Privacy-first: all processing happens locally.
 *
 * @see lib/hooks/use-edge-search.ts — client-side equivalent
 * @see lib/security/vector-validation.ts — validation for incoming vectors
 */

// Model configuration — must match client-side hook exactly
export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSIONS = 384;

// Lazy-loaded pipeline singleton
let pipelineInstance: any = null;
let pipelineLoading: Promise<any> | null = null;

/**
 * Lazily initializes the Transformers.js feature-extraction pipeline.
 * The model is downloaded once and cached by the library.
 */
async function getPipeline(): Promise<any> {
    if (pipelineInstance) return pipelineInstance;

    // Prevent duplicate loading if called concurrently
    if (pipelineLoading) return pipelineLoading;

    pipelineLoading = (async () => {
        try {
            const { pipeline } = await import('@xenova/transformers');
            pipelineInstance = await pipeline('feature-extraction', EMBEDDING_MODEL, {
                // Use quantized model for faster loading on server
                quantized: true,
            });
            console.log(`[Embedding Service] Model loaded: ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}d)`);
            return pipelineInstance;
        } catch (error) {
            pipelineLoading = null; // Allow retry on failure
            console.error('[Embedding Service] Failed to load model:', error);
            throw error;
        }
    })();

    return pipelineLoading;
}

/**
 * Simple deterministic hash-based embedding fallback.
 * Produces a 384-dimensional vector from text using character-level hashing.
 * NOT semantically meaningful — used only when the ML model fails to load.
 */
function simpleHashEmbedding(text: string, dimensions: number = EMBEDDING_DIMENSIONS): number[] {
    const embedding = new Array(dimensions).fill(0);
    const normalized = text.toLowerCase().trim();

    for (let i = 0; i < normalized.length; i++) {
        const charCode = normalized.charCodeAt(i);
        const position = i % dimensions;
        embedding[position] += Math.sin(charCode * (i + 1) * 0.1) * 0.1;
        embedding[(position + 1) % dimensions] += Math.cos(charCode * (i + 1) * 0.1) * 0.1;
    }

    // L2 normalize
    const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
    if (norm > 0) {
        for (let i = 0; i < dimensions; i++) {
            embedding[i] /= norm;
        }
    }

    return embedding;
}

/**
 * Generate embedding vector for text.
 * Uses Transformers.js (MiniLM) server-side, matching the client's Edge Search hook.
 * Falls back to hash embedding if the model fails to load.
 *
 * @param text — input text to embed
 * @returns 384-dimensional embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty for embedding generation');
    }

    try {
        const extractor = await getPipeline();
        const output = await extractor(text.trim(), {
            pooling: 'mean',
            normalize: true,
        });

        // output.data is a Float32Array — convert to number[]
        return Array.from(output.data as Float32Array);
    } catch (error) {
        console.warn('[Embedding Service] Model inference failed, using hash fallback:', error);
        return simpleHashEmbedding(text);
    }
}

/**
 * Generate embedding for an ingredient.
 * Combines the ingredient name with its category for richer semantics.
 *
 * @param name — Ingredient name (e.g., "Tomato")
 * @param category — Optional category (e.g., "Vegetable")
 */
export async function generateIngredientEmbedding(
    name: string,
    category?: string | null
): Promise<number[]> {
    const text = category ? `${name} (${category})` : name;
    return generateEmbedding(text);
}

/**
 * Generate embedding for a recipe.
 * Combines title, description, and ingredients for comprehensive representation.
 *
 * @param title — Recipe title
 * @param description — Recipe description
 * @param ingredients — Array of ingredient names
 */
export async function generateRecipeEmbedding(
    title: string,
    description: string,
    ingredients: string[]
): Promise<number[]> {
    const ingredientList = ingredients.join(', ');
    const text = `${title}. ${description}. Ingredients: ${ingredientList}`;
    return generateEmbedding(text);
}

/**
 * Calculate cosine similarity between two vectors.
 * Returns a value between 0 (different) and 1 (identical).
 *
 * @param vecA — First vector
 * @param vecB — Second vector
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error(
            `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}. ` +
            `Both must be ${EMBEDDING_DIMENSIONS}-dimensional.`
        );
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
 * Batch generate embeddings.
 * Processes texts sequentially to keep server memory usage bounded.
 *
 * @param texts — Array of texts to embed
 * @param batchSize — Number of texts to process at once
 * @param delayMs — Delay between batches (for GC breathing room)
 */
export async function batchGenerateEmbeddings(
    texts: string[],
    batchSize: number = 32,
    delayMs: number = 100
): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        console.log(`[Embedding Service] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);

        const batchResults = await Promise.all(
            batch.map((text) => generateEmbedding(text))
        );

        embeddings.push(...batchResults);

        // Brief delay between batches
        if (i + batchSize < texts.length) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    return embeddings;
}
