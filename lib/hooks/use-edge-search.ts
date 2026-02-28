/**
 * Edge Search Hook - Client-Side Transformers.js Embeddings
 *
 * Zero-cost semantic search using Xenova/all-MiniLM-L6-v2 model.
 * Generates 384-dimensional embeddings directly in the browser.
 *
 * Security: Model integrity verification via SHA-256 manifest check.
 * Privacy: All data processing happens on-device, nothing sent to servers.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { verifyModel } from '@/lib/security/model-integrity';

// Dynamic import to avoid SSR issues
let pipeline: any = null;
let FeatureExtraction: any = null;

export interface EmbeddingResult {
    embedding: number[];
    processingTime: number;
}

interface UseEdgeSearchOptions {
    autoLoad?: boolean; // Automatically load model on mount
    model?: string; // Default: Xenova/all-MiniLM-L6-v2
}

export function useEdgeSearch(options: UseEdgeSearchOptions = {}) {
    const {
        autoLoad = false,
        model = 'Xenova/all-MiniLM-L6-v2' // 384-dimensional embeddings
    } = options;

    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Store the feature extraction pipeline
    const extractorRef = useRef<any | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    /**
     * Check if browser supports WebAssembly (required for Transformers.js)
     */
    const checkSupport = useCallback((): { supported: boolean; reason?: string } => {
        if (typeof WebAssembly === 'undefined') {
            return { supported: false, reason: 'WebAssembly not supported' };
        }

        // Check for required features
        if (typeof Worker === 'undefined') {
            return { supported: false, reason: 'Web Workers not supported' };
        }

        return { supported: true };
    }, []);

    /**
     * Load Transformers.js pipeline
     */
    const loadModel = useCallback(async () => {
        if (extractorRef.current || isLoading) return; // Already loaded or loading

        const support = checkSupport();
        if (!support.supported) {
            if (isMountedRef.current) {
                setError(support.reason || 'Device not supported');
            }
            return;
        }

        if (isMountedRef.current) {
            setIsLoading(true);
            setError(null);
            setLoadProgress(0);
        }

        try {
            // Dynamic import of Transformers.js (client-side only)
            if (!pipeline) {
                if (isMountedRef.current) setLoadProgress(10);
                const transformers = await import('@xenova/transformers');
                pipeline = transformers.pipeline;
                FeatureExtraction = transformers.FeatureExtractionPipeline;
                console.log('✅ Transformers.js library loaded');
            }

            if (isMountedRef.current) setLoadProgress(20);

            // Model integrity verification
            // When model is self-hosted in /public/models/all-MiniLM-L6-v2/, this will
            // validate SHA-256 hashes. For CDN-loaded models, it warns and proceeds.
            const integrityResult = await verifyModel('all-MiniLM-L6-v2');
            if (!integrityResult.valid) {
                const isMissingManifest = integrityResult.errors.some(
                    e => e.includes('manifest not found') || e.includes('not found in manifest')
                );
                if (isMissingManifest) {
                    console.warn('[Edge Search] Model integrity manifest not found — loading from CDN. ' +
                        'Self-host models in /public/models/all-MiniLM-L6-v2/ and run npm run build:model-hashes for full verification.');
                } else {
                    throw new Error(`Model integrity check failed: ${integrityResult.errors.join(', ')}`);
                }
            }

            if (isMountedRef.current) setLoadProgress(30);

            // Load the model (first time will download ~20MB, subsequent loads use cache)
            console.log(`[Edge Search] Loading model: ${model}...`);
            const extractor = await pipeline('feature-extraction', model, {
                quantized: true, // Use quantized model for smaller size
                progress_callback: (progress: any) => {
                    if (progress.status === 'progress' && isMountedRef.current) {
                        const percent = Math.round((progress.loaded / progress.total) * 70) + 30;
                        setLoadProgress(Math.min(100, percent));
                    }
                }
            });

            extractorRef.current = extractor;

            if (isMountedRef.current) {
                setLoadProgress(100);
                setIsReady(true);
                setIsLoading(false);
                console.log('✅ Edge Search model loaded successfully');
            }
        } catch (err) {
            console.error('Failed to load Edge Search model:', err);
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to load model');
                setIsLoading(false);
            }
        }
    }, [model, isLoading, checkSupport]);

    /**
     * Generate embedding for text
     * @param text - Input text to embed
     * @returns 384-dimensional embedding vector
     */
    const generateEmbedding = useCallback(
        async (text: string): Promise<EmbeddingResult> => {
            if (!extractorRef.current) {
                throw new Error('Model not loaded. Call loadModel() first.');
            }

            if (!text || text.trim().length === 0) {
                throw new Error('Text cannot be empty');
            }

            const startTime = performance.now();

            if (isMountedRef.current) {
                setError(null);
            }

            try {
                // Generate embedding
                const output = await extractorRef.current(text, {
                    pooling: 'mean', // Mean pooling across all tokens
                    normalize: true   // L2 normalization
                });

                // Extract the embedding array
                const embedding = Array.from(output.data) as number[];
                const processingTime = Math.round(performance.now() - startTime);

                console.log(`[Edge Search] Generated ${embedding.length}D embedding in ${processingTime}ms`);

                return {
                    embedding,
                    processingTime
                };
            } catch (err) {
                console.error('Embedding generation error:', err);
                if (isMountedRef.current) {
                    setError(err instanceof Error ? err.message : 'Embedding generation failed');
                }
                throw err;
            }
        },
        []
    );

    /**
     * Calculate cosine similarity between two embeddings
     * Returns 0 for degenerate inputs (zero vectors) instead of NaN
     */
    const cosineSimilarity = useCallback(
        (embedding1: number[], embedding2: number[]): number => {
            if (embedding1.length !== embedding2.length) {
                throw new Error('Embeddings must have same dimensions');
            }

            let dotProduct = 0;
            let norm1 = 0;
            let norm2 = 0;

            for (let i = 0; i < embedding1.length; i++) {
                dotProduct += embedding1[i] * embedding2[i];
                norm1 += embedding1[i] * embedding1[i];
                norm2 += embedding2[i] * embedding2[i];
            }

            const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
            if (denominator === 0) return 0;

            const similarity = dotProduct / denominator;
            // Guard against NaN/Infinity from floating-point edge cases
            if (!Number.isFinite(similarity)) return 0;
            return similarity;
        },
        []
    );

    /**
     * Auto-load model if requested
     */
    useEffect(() => {
        if (autoLoad && !isLoading && !isReady) {
            loadModel();
        }
    }, [autoLoad, isLoading, isReady, loadModel]);

    return {
        isLoading,
        isReady,
        loadProgress,
        error,
        isSupported: checkSupport().supported,
        loadModel,
        generateEmbedding,
        cosineSimilarity,
    };
}
