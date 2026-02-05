/**
 * Edge Vision Service  
 * Client-side ingredient recognition using TensorFlow.js
 * Replaces expensive Gemini Vision API with free, privacy-first local inference
 */

'use client';

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface DetectedIngredient {
    name: string;
    confidence: number;
    bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface VisionAnalysisResult {
    ingredients: DetectedIngredient[];
    processingTime: number;
    modelVersion: string;
}

// Food-related items from COCO-SSD model
const FOOD_CATEGORIES = new Set([
    'banana', 'apple', 'sandwich', 'orange', 'broccoli',
    'carrot', 'hot dog', 'pizza', 'donut', 'cake',
    'bottle', 'wine glass', 'cup', 'fork', 'knife',
    'spoon', 'bowl'
]);

class EdgeVisionService {
    private model: cocoSsd.ObjectDetection | null = null;
    private modelLoading: Promise<void> | null = null;
    private isReady = false;

    /**
     * Initialize TensorFlow.js and load the COCO-SSD model
     */
    async initialize(): Promise<void> {
        if (this.isReady) return;
        if (this.modelLoading) return await this.modelLoading;

        this.modelLoading = (async () => {
            try {
                console.log('[EdgeVision] Initializing TensorFlow.js...');

                // Set backend to WebGL for better performance
                await tf.setBackend('webgl');
                await tf.ready();

                console.log('[EdgeVision] Loading COCO-SSD model...');
                const startTime = performance.now();

                this.model = await cocoSsd.load({
                    base: 'mobilenet_v2' // Smaller, faster model (good for mobile)
                });

                const loadTime = performance.now() - startTime;
                console.log(`[EdgeVision] Model loaded in ${loadTime.toFixed(0)}ms`);

                this.isReady = true;
            } catch (error) {
                console.error('[EdgeVision] Failed to initialize:', error);
                throw new Error('Failed to load vision model');
            }
        })();

        await this.modelLoading;
    }

    /**
     * Analyze an image and detect food items
     */
    async analyzeImage(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<VisionAnalysisResult> {
        if (!this.isReady || !this.model) {
            await this.initialize();
        }

        const startTime = performance.now();

        try {
            // Run object detection
            const predictions = await this.model!.detect(imageElement);

            // Filter for food-related items
            const ingredients: DetectedIngredient[] = predictions
                .filter(pred => FOOD_CATEGORIES.has(pred.class))
                .map(pred => ({
                    name: pred.class,
                    confidence: pred.score,
                    bbox: pred.bbox as [number, number, number, number]
                }))
                .sort((a, b) => b.confidence - a.confidence); // Highest confidence first

            const processingTime = performance.now() - startTime;

            console.log(`[EdgeVision] Detected ${ingredients.length} food items in ${processingTime.toFixed(0)}ms`);

            return {
                ingredients,
                processingTime,
                modelVersion: 'coco-ssd-mobilenet_v2'
            };
        } catch (error) {
            console.error('[EdgeVision] Analysis failed:', error);
            throw new Error('Failed to analyze image');
        }
    }

    /**
     * Analyze a video stream frame-by-frame
     * Optimized for real-time detection
     */
    async analyzeVideoStream(
        videoElement: HTMLVideoElement,
        onDetection: (result: VisionAnalysisResult) => void,
        options: {
            fps?: number; // Frames per second to analyze (default: 2)
            minConfidence?: number; // Minimum confidence threshold (default: 0.5)
        } = {}
    ): Promise<() => void> {
        const { fps = 2, minConfidence = 0.5 } = options;
        const interval = 1000 / fps;
        let isRunning = true;

        const analyze = async () => {
            if (!isRunning) return;

            try {
                const result = await this.analyzeImage(videoElement);

                // Filter by confidence
                result.ingredients = result.ingredients.filter(
                    ing => ing.confidence >= minConfidence
                );

                onDetection(result);
            } catch (error) {
                console.error('[EdgeVision] Stream analysis error:', error);
            }

            if (isRunning) {
                setTimeout(analyze, interval);
            }
        };

        analyze();

        // Return stop function
        return () => {
            isRunning = false;
        };
    }

    /**
     * Check if the browser supports TensorFlow.js
     */
    static isSupported(): boolean {
        if (typeof window === 'undefined') return false;

        // Check for WebGL support
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            console.warn('[EdgeVision] WebGL not supported');
            return false;
        }

        return true;
    }

    /**
     * Get memory usage information (for debugging)
     */
    getMemoryInfo(): { numTensors: number; numBytes: number } {
        return {
            numTensors: tf.memory().numTensors,
            numBytes: tf.memory().numBytes
        };
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        if (this.model) {
            this.model = null;
            this.isReady = false;
            console.log('[EdgeVision] Model disposed');
        }
    }
}

// Singleton instance
let edgeVisionInstance: EdgeVisionService | null = null;

export function getEdgeVisionService(): EdgeVisionService {
    if (!edgeVisionInstance) {
        edgeVisionInstance = new EdgeVisionService();
    }
    return edgeVisionInstance;
}

export { EdgeVisionService };
