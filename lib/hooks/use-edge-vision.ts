/**
 * Edge Vision Hook - Client-Side TensorFlow.js Object Detection
 *
 * Uses COCO-SSD model to detect food ingredients directly in the browser.
 * Zero API costs, privacy-first (data never leaves device).
 *
 * Security: Model loaded from public/models/ with integrity verification (TODO: Phase 3.0)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';

export interface DetectedObject {
    name: string;
    confidence: number;
    bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface EdgeVisionResult {
    objects: DetectedObject[];
    processingTime: number;
}

interface UseEdgeVisionOptions {
    autoLoad?: boolean; // Automatically load model on mount
    minConfidence?: number; // Minimum confidence threshold (0-1)
}

export function useEdgeVision(options: UseEdgeVisionOptions = {}) {
    const { autoLoad = false, minConfidence = 0.6 } = options;

    const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Track if component is mounted to prevent state updates on unmounted component
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    /**
     * Check if WebGL and WASM are supported (graceful degradation)
     */
    const checkSupport = useCallback((): { supported: boolean; reason?: string } => {
        // Check for WebAssembly support
        if (typeof WebAssembly === 'undefined') {
            return { supported: false, reason: 'WebAssembly not supported' };
        }

        // Check for WebGL support
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) {
                return { supported: false, reason: 'WebGL not supported' };
            }
        } catch (e) {
            return { supported: false, reason: 'WebGL not available' };
        }

        return { supported: true };
    }, []);

    /**
     * Load COCO-SSD model
     */
    const loadModel = useCallback(async () => {
        if (model || isLoading) return; // Already loaded or loading

        // Check device support first
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
            // Set backend to WebGL for better performance
            await tf.setBackend('webgl');
            await tf.ready();

            if (isMountedRef.current) setLoadProgress(30);

            // Load COCO-SSD model (~5MB download)
            // TODO: Load from /public/models/ with integrity verification
            const loadedModel = await cocoSsd.load({
                base: 'lite_mobilenet_v2', // Smaller, faster model (~5MB)
            });

            if (isMountedRef.current) {
                setLoadProgress(100);
                setModel(loadedModel);
                setIsLoading(false);
                console.log('✅ Edge Vision model loaded successfully');
            }
        } catch (err) {
            console.error('Failed to load Edge Vision model:', err);
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to load model');
                setIsLoading(false);
            }
        }
    }, [model, isLoading, checkSupport]);

    /**
     * Detect objects in image
     * @param imageElement - HTMLImageElement, HTMLVideoElement, or HTMLCanvasElement
     */
    const detect = useCallback(
        async (
            imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
        ): Promise<EdgeVisionResult> => {
            if (!model) {
                throw new Error('Model not loaded. Call loadModel() first.');
            }

            const startTime = performance.now();

            if (isMountedRef.current) {
                setIsAnalyzing(true);
                setError(null);
            }

            try {
                // Run detection
                const predictions = await model.detect(imageElement);

                // Filter by confidence and map to food items
                const foodKeywords = new Set([
                    'apple', 'banana', 'orange', 'broccoli', 'carrot', 'hot dog',
                    'pizza', 'donut', 'cake', 'sandwich', 'bread', 'tomato', 'onion',
                    'potato', 'lemon', 'lime', 'pear', 'pineapple', 'watermelon',
                    'strawberry', 'grapes', 'peach', 'cherry', 'kiwi', 'mango',
                    'bowl', 'cup', 'bottle', 'knife', 'spoon', 'fork'
                ]);

                const objects: DetectedObject[] = predictions
                    .filter(pred => {
                        const isFood = foodKeywords.has(pred.class.toLowerCase());
                        const meetsConfidence = pred.score >= minConfidence;
                        return isFood && meetsConfidence;
                    })
                    .map(pred => ({
                        name: pred.class,
                        confidence: pred.score,
                        bbox: pred.bbox as [number, number, number, number],
                    }));

                const processingTime = Math.round(performance.now() - startTime);

                if (isMountedRef.current) {
                    setIsAnalyzing(false);
                }

                return {
                    objects,
                    processingTime,
                };
            } catch (err) {
                console.error('Detection error:', err);
                if (isMountedRef.current) {
                    setIsAnalyzing(false);
                    setError(err instanceof Error ? err.message : 'Detection failed');
                }
                throw err;
            }
        },
        [model, minConfidence]
    );

    /**
     * Cleanup model on unmount
     */
    useEffect(() => {
        if (autoLoad) {
            loadModel();
        }

        return () => {
            if (model) {
                // model.dispose(); // COCO-SSD doesn't expose dispose, but TF will clean up
                console.log('Edge Vision model cleaned up');
            }
        };
    }, [autoLoad]); // Only run on mount/unmount

    return {
        model,
        isLoading,
        isAnalyzing,
        loadProgress,
        error,
        isSupported: checkSupport().supported,
        loadModel,
        detect,
    };
}
