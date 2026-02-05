/**
 * Edge Search Service
 * Client-side text embeddings using Transformers.js
 * Replaces expensive OpenAI Embeddings API with free, privacy-first local inference
 */

'use client';

// We'll use Transformers.js when we install it
// For now, this is the interface
export interface SearchEmbedding {
    vector: number[];
    dimensions: number;
    modelVersion: string;
    processingTime: number;
}

export interface EdgeSearchOptions {
    maxLength?: number; // Maximum token length (default: 128)
    normalize?: boolean; // Normalize embeddings (default: true)
}

class EdgeSearchService {
    private pipeline: any = null;
    private isReady = false;
    private modelLoading: Promise<void> | null = null;

    /**
     * Initialize Transformers.js and load the embedding model
     * Using Xenova/all-MiniLM-L6-v2 (384 dimensions, ~20MB)
     */
    async initialize(): Promise<void> {
        if (this.isReady) return;
        if (this.modelLoading) return await this.modelLoading;

        this.modelLoading = (async () => {
            try {
                console.log('[EdgeSearch] Loading Transformers.js...');

                // Dynamically import to avoid SSR issues
                const { pipeline } = await import('@xenova/transformers');

                console.log('[EdgeSearch] Loading embedding model...');
                const startTime = performance.now();

                // Load the feature-extraction pipeline
                this.pipeline = await pipeline(
                    'feature-extraction',
                    'Xenova/all-MiniLM-L6-v2',
                    {
                        quantized: true, // Use quantized model for smaller size
                    }
                );

                const loadTime = performance.now() - startTime;
                console.log(`[EdgeSearch] Model loaded in ${loadTime.toFixed(0)}ms`);

                this.isReady = true;
            } catch (error) {
                console.error('[EdgeSearch] Failed to initialize:', error);
                throw new Error('Failed to load search model');
            }
        })();

        await this.modelLoading;
    }

    /**
     * Generate embedding vector for a text query
     */
    async generateEmbedding(text: string, options: EdgeSearchOptions = {}): Promise<SearchEmbedding> {
        if (!this.isReady || !this.pipeline) {
            await this.initialize();
        }

        const { maxLength = 128, normalize = true } = options;
        const startTime = performance.now();

        try {
            // Generate embedding
            const output = await this.pipeline(text, {
                pooling: 'mean', // Mean pooling
                normalize: normalize, // L2 normalization
                max_length: maxLength,
            });

            // Extract the embedding array
            const vector = Array.from(output.data) as number[];
            const processingTime = performance.now() - startTime;

            console.log(`[EdgeSearch] Generated embedding (${vector.length}D) in ${processingTime.toFixed(0)}ms`);

            return {
                vector,
                dimensions: vector.length,
                modelVersion: 'Xenova/all-MiniLM-L6-v2',
                processingTime
            };
        } catch (error) {
            console.error('[EdgeSearch] Embedding generation failed:', error);
            throw new Error('Failed to generate embedding');
        }
    }

    /**
     * Generate embeddings for multiple texts in batch
     */
    async generateBatchEmbeddings(
        texts: string[],
        options: EdgeSearchOptions = {}
    ): Promise<SearchEmbedding[]> {
        console.log(`[EdgeSearch] Generating ${texts.length} embeddings in batch...`);

        // Process in parallel for better performance
        const embeddings = await Promise.all(
            texts.map(text => this.generateEmbedding(text, options))
        );

        return embeddings;
    }

    /**
     * Calculate cosine similarity between two embeddings
     * Returns a value between -1 and 1 (higher = more similar)
     */
    static cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same dimensions');
        }

        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            magnitudeA += a[i] * a[i];
            magnitudeB += b[i] * b[i];
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Check if the browser supports Transformers.js
     */
    static isSupported(): boolean {
        if (typeof window === 'undefined') return false;

        // Check for WebAssembly support
        if (typeof WebAssembly === 'undefined') {
            console.warn('[EdgeSearch] WebAssembly not supported');
            return false;
        }

        // Check for Worker support
        if (typeof Worker === 'undefined') {
            console.warn('[EdgeSearch] Web Workers not supported');
            return false;
        }

        return true;
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        if (this.pipeline) {
            // Transformers.js doesn't have explicit dispose, just null out
            this.pipeline = null;
            this.isReady = false;
            console.log('[EdgeSearch] Model disposed');
        }
    }
}

// Singleton instance
let edgeSearchInstance: EdgeSearchService | null = null;

export function getEdgeSearchService(): EdgeSearchService {
    if (!edgeSearchInstance) {
        edgeSearchInstance = new EdgeSearchService();
    }
    return edgeSearchInstance;
}

export { EdgeSearchService };
