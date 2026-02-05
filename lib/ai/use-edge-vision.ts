/**
 * useEdgeVision Hook
 * React hook for client-side ingredient detection
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getEdgeVisionService, VisionAnalysisResult, EdgeVisionService } from '@/lib/ai/edge-vision';

export interface EdgeVisionState {
    isSupported: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    isAnalyzing: boolean;
    error: string | null;
    result: VisionAnalysisResult | null;
}

export function useEdgeVision() {
    const [state, setState] = useState<EdgeVisionState>({
        isSupported: false,
        isInitialized: false,
        isLoading: false,
        isAnalyzing: false,
        error: null,
        result: null
    });

    const serviceRef = useRef<EdgeVisionService | null>(null);
    const stopStreamRef = useRef<(() => void) | null>(null);

    // Check support on mount
    useEffect(() => {
        const isSupported = EdgeVisionService.isSupported();
        setState(prev => ({ ...prev, isSupported }));

        if (!isSupported) {
            setState(prev => ({
                ...prev,
                error: 'Your browser does not support AI features. Please use a modern browser.'
            }));
        }
    }, []);

    /**
     * Initialize the vision service
     */
    const initialize = useCallback(async () => {
        if (state.isInitialized || state.isLoading) return;
        if (!state.isSupported) {
            setState(prev => ({ ...prev, error: 'Browser not supported' }));
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            serviceRef.current = getEdgeVisionService();
            await serviceRef.current.initialize();

            setState(prev => ({
                ...prev,
                isInitialized: true,
                isLoading: false
            }));
        } catch (error) {
            console.error('[useEdgeVision] Initialization error:', error);
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to initialize AI'
            }));
        }
    }, [state.isInitialized, state.isLoading, state.isSupported]);

    /**
     * Analyze a single image
     */
    const analyzeImage = useCallback(async (
        imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ) => {
        if (!serviceRef.current) {
            await initialize();
        }

        if (!serviceRef.current) {
            setState(prev => ({ ...prev, error: 'Vision service not available' }));
            return null;
        }

        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));

        try {
            const result = await serviceRef.current.analyzeImage(imageElement);

            setState(prev => ({
                ...prev,
                isAnalyzing: false,
                result
            }));

            return result;
        } catch (error) {
            console.error('[useEdgeVision] Analysis error:', error);
            setState(prev => ({
                ...prev,
                isAnalyzing: false,
                error: error instanceof Error ? error.message : 'Analysis failed'
            }));
            return null;
        }
    }, [initialize]);

    /**
     * Start analyzing a video stream
     */
    const startVideoAnalysis = useCallback(async (
        videoElement: HTMLVideoElement,
        onDetection: (result: VisionAnalysisResult) => void,
        options?: { fps?: number; minConfidence?: number }
    ) => {
        if (!serviceRef.current) {
            await initialize();
        }

        if (!serviceRef.current) {
            setState(prev => ({ ...prev, error: 'Vision service not available' }));
            return;
        }

        // Stop any existing stream
        if (stopStreamRef.current) {
            stopStreamRef.current();
        }

        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));

        try {
            stopStreamRef.current = await serviceRef.current.analyzeVideoStream(
                videoElement,
                (result) => {
                    setState(prev => ({ ...prev, result }));
                    onDetection(result);
                },
                options
            );
        } catch (error) {
            console.error('[useEdgeVision] Stream analysis error:', error);
            setState(prev => ({
                ...prev,
                isAnalyzing: false,
                error: error instanceof Error ? error.message : 'Stream analysis failed'
            }));
        }
    }, [initialize]);

    /**
     * Stop video stream analysis
     */
    const stopVideoAnalysis = useCallback(() => {
        if (stopStreamRef.current) {
            stopStreamRef.current();
            stopStreamRef.current = null;
            setState(prev => ({ ...prev, isAnalyzing: false }));
        }
    }, []);

    /**
     * Get memory usage info
     */
    const getMemoryInfo = useCallback(() => {
        if (serviceRef.current) {
            return serviceRef.current.getMemoryInfo();
        }
        return { numTensors: 0, numBytes: 0 };
    }, []);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            stopVideoAnalysis();
            if (serviceRef.current) {
                serviceRef.current.dispose();
            }
        };
    }, [stopVideoAnalysis]);

    return {
        ...state,
        initialize,
        analyzeImage,
        startVideoAnalysis,
        stopVideoAnalysis,
        getMemoryInfo
    };
}
