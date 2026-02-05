/**
 * useEdgeSearch Hook
 * React hook for client-side semantic search with embeddings
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getEdgeSearchService, SearchEmbedding, EdgeSearchService, EdgeSearchOptions } from '@/lib/ai/edge-search';

export interface EdgeSearchState {
    isSupported: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    isGenerating: boolean;
    error: string | null;
    lastEmbedding: SearchEmbedding | null;
}

export function useEdgeSearch() {
    const [state, setState] = useState<EdgeSearchState>({
        isSupported: false,
        isInitialized: false,
        isLoading: false,
        isGenerating: false,
        error: null,
        lastEmbedding: null
    });

    const serviceRef = useRef<EdgeSearchService | null>(null);

    // Check support on mount
    useEffect(() => {
        const isSupported = EdgeSearchService.isSupported();
        setState(prev => ({ ...prev, isSupported }));

        if (!isSupported) {
            setState(prev => ({
                ...prev,
                error: 'Your browser does not support semantic search. Some features may be limited.'
            }));
        }
    }, []);

    /**
     * Initialize the search service
     */
    const initialize = useCallback(async () => {
        if (state.isInitialized || state.isLoading) return;
        if (!state.isSupported) {
            setState(prev => ({ ...prev, error: 'Browser not supported' }));
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            serviceRef.current = getEdgeSearchService();
            await serviceRef.current.initialize();

            setState(prev => ({
                ...prev,
                isInitialized: true,
                isLoading: false
            }));
        } catch (error) {
            console.error('[useEdgeSearch] Initialization error:', error);
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to initialize search'
            }));
        }
    }, [state.isInitialized, state.isLoading, state.isSupported]);

    /**
     * Generate embedding for a text query
     */
    const generateEmbedding = useCallback(async (
        text: string,
        options?: EdgeSearchOptions
    ): Promise<SearchEmbedding | null> => {
        if (!serviceRef.current) {
            await initialize();
        }

        if (!serviceRef.current) {
            setState(prev => ({ ...prev, error: 'Search service not available' }));
            return null;
        }

        setState(prev => ({ ...prev, isGenerating: true, error: null }));

        try {
            const embedding = await serviceRef.current.generateEmbedding(text, options);

            setState(prev => ({
                ...prev,
                isGenerating: false,
                lastEmbedding: embedding
            }));

            return embedding;
        } catch (error) {
            console.error('[useEdgeSearch] Generation error:', error);
            setState(prev => ({
                ...prev,
                isGenerating: false,
                error: error instanceof Error ? error.message : 'Embedding generation failed'
            }));
            return null;
        }
    }, [initialize]);

    /**
     * Generate embeddings for multiple texts
     */
    const generateBatchEmbeddings = useCallback(async (
        texts: string[],
        options?: EdgeSearchOptions
    ): Promise<SearchEmbedding[] | null> => {
        if (!serviceRef.current) {
            await initialize();
        }

        if (!serviceRef.current) {
            setState(prev => ({ ...prev, error: 'Search service not available' }));
            return null;
        }

        setState(prev => ({ ...prev, isGenerating: true, error: null }));

        try {
            const embeddings = await serviceRef.current.generateBatchEmbeddings(texts, options);

            setState(prev => ({
                ...prev,
                isGenerating: false
            }));

            return embeddings;
        } catch (error) {
            console.error('[useEdgeSearch] Batch generation error:', error);
            setState(prev => ({
                ...prev,
                isGenerating: false,
                error: error instanceof Error ? error.message : 'Batch generation failed'
            }));
            return null;
        }
    }, [initialize]);

    /**
     * Calculate similarity between two embeddings
     */
    const calculateSimilarity = useCallback((a: number[], b: number[]): number => {
        return EdgeSearchService.cosineSimilarity(a, b);
    }, []);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            if (serviceRef.current) {
                serviceRef.current.dispose();
            }
        };
    }, []);

    return {
        ...state,
        initialize,
        generateEmbedding,
        generateBatchEmbeddings,
        calculateSimilarity
    };
}
