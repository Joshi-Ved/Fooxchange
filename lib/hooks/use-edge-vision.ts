/**
 * Edge Vision Hook - Client-Side TensorFlow.js Object Detection
 *
 * Uses COCO-SSD model to detect food ingredients directly in the browser.
 * Zero API costs, privacy-first (data never leaves device).
 *
 * Security: Model integrity verification via SHA-256 manifest check.
 * When models are self-hosted in /public/models/, the integrity check blocks
 * loading if hashes don't match. For CDN-loaded models, it warns and proceeds.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import { verifyModel } from '@/lib/security/model-integrity';

type OnnxModule = typeof import('onnxruntime-web');

interface YoloCandidate {
    name: string;
    confidence: number;
    bbox: [number, number, number, number];
}

interface YoloRuntimeState {
    ort: OnnxModule;
    session: import('onnxruntime-web').InferenceSession;
    inputName: string;
    outputName: string;
    inputWidth: number;
    inputHeight: number;
    classes: Record<number, string>;
}

export interface DetectedObject {
    name: string;
    confidence: number;
    bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface EdgeVisionResult {
    objects: DetectedObject[];
    processingTime: number;
    rawCount: number;
    rawTopPredictions: Array<{ name: string; confidence: number }>;
}

interface UseEdgeVisionOptions {
    autoLoad?: boolean; // Automatically load model on mount
    minConfidence?: number; // Minimum confidence threshold (0-1)
}

const FOOD_KEYWORDS = new Set([
    'apple', 'banana', 'orange', 'broccoli', 'carrot', 'hot dog',
    'pizza', 'donut', 'cake', 'sandwich', 'bread', 'tomato', 'onion',
    'potato', 'lemon', 'lime', 'pear', 'pineapple', 'watermelon',
    'strawberry', 'grapes', 'peach', 'cherry', 'kiwi', 'mango',
]);

// COCO-SSD can under-score chopped produce; this keeps recall usable for food scanning.
const LOW_CONF_PRODUCE_CLASSES = new Set(['apple', 'tomato', 'onion', 'potato', 'carrot', 'broccoli']);

const normalizeCocoClassName = (
    className: string,
    score: number,
    predictions: Array<{ class: string; score: number }>
): string => {
    const lowered = className.toLowerCase();

    // Common confusion in kitchen scenes: tomato and apple.
    if (lowered === 'apple' && score < 0.7) {
        const tomatoCandidate = predictions.find((p) => p.class.toLowerCase() === 'tomato');
        if (tomatoCandidate && tomatoCandidate.score >= 0.15 && score - tomatoCandidate.score <= 0.2) {
            return 'tomato';
        }
    }

    return lowered;
};

export function useEdgeVision(options: UseEdgeVisionOptions = {}) {
    const { autoLoad = false, minConfidence = 0.6 } = options;

    const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
    const [isModelReady, setIsModelReady] = useState(false);
    const [modelSource, setModelSource] = useState<'food-yolo' | 'coco-ssd' | null>(null);
    const [isSupported, setIsSupported] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Track if component is mounted to prevent state updates on unmounted component
    const isMountedRef = useRef(true);
    const yoloRef = useRef<YoloRuntimeState | null>(null);

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

    useEffect(() => {
        const support = checkSupport();
        setIsSupported(support.supported);
    }, [checkSupport]);

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const iou = (a: YoloCandidate, b: YoloCandidate): number => {
        const [ax, ay, aw, ah] = a.bbox;
        const [bx, by, bw, bh] = b.bbox;
        const ax2 = ax + aw;
        const ay2 = ay + ah;
        const bx2 = bx + bw;
        const by2 = by + bh;

        const interX1 = Math.max(ax, bx);
        const interY1 = Math.max(ay, by);
        const interX2 = Math.min(ax2, bx2);
        const interY2 = Math.min(ay2, by2);

        const interW = Math.max(0, interX2 - interX1);
        const interH = Math.max(0, interY2 - interY1);
        const interArea = interW * interH;
        const unionArea = aw * ah + bw * bh - interArea;
        if (unionArea <= 0) return 0;
        return interArea / unionArea;
    };

    const nms = (candidates: YoloCandidate[], iouThreshold = 0.45): YoloCandidate[] => {
        const byScore = [...candidates].sort((a, b) => b.confidence - a.confidence);
        const kept: YoloCandidate[] = [];

        for (const current of byScore) {
            const overlaps = kept.some((picked) => picked.name === current.name && iou(picked, current) > iouThreshold);
            if (!overlaps) {
                kept.push(current);
            }
        }

        return kept;
    };

    const parseYoloDetections = (
        outputData: Float32Array,
        dims: readonly number[],
        classes: Record<number, string>,
        imageWidth: number,
        imageHeight: number,
        inputWidth: number,
        inputHeight: number
    ) => {
        let channels = 0;
        let count = 0;
        let isChannelsFirst = true;

        if (dims.length !== 3) {
            return {
                candidates: [] as YoloCandidate[],
                rawTopPredictions: [] as Array<{ name: string; confidence: number }>,
            };
        }

        const d1 = Number(dims[1]);
        const d2 = Number(dims[2]);
        if (d1 > d2) {
            count = d1;
            channels = d2;
            isChannelsFirst = false;
        } else {
            channels = d1;
            count = d2;
            isChannelsFirst = true;
        }

        const scaleX = imageWidth / inputWidth;
        const scaleY = imageHeight / inputHeight;
        const rawPredictions: Array<{ name: string; confidence: number }> = [];
        const candidates: YoloCandidate[] = [];

        const getValue = (channel: number, index: number) => {
            if (isChannelsFirst) {
                return outputData[channel * count + index];
            }
            return outputData[index * channels + channel];
        };

        for (let i = 0; i < count; i++) {
            const cx = getValue(0, i);
            const cy = getValue(1, i);
            const w = getValue(2, i);
            const h = getValue(3, i);

            let bestClass = -1;
            let bestScore = 0;
            for (let c = 4; c < channels; c++) {
                const score = getValue(c, i);
                if (score > bestScore) {
                    bestScore = score;
                    bestClass = c - 4;
                }
            }

            const className = classes[bestClass] || `class_${bestClass}`;
            if (bestClass >= 0 && bestScore >= 0.05) {
                rawPredictions.push({ name: className, confidence: bestScore });
            }

            if (bestClass < 0 || bestScore < minConfidence) continue;

            const x = clamp((cx - w / 2) * scaleX, 0, imageWidth);
            const y = clamp((cy - h / 2) * scaleY, 0, imageHeight);
            const bw = clamp(w * scaleX, 1, imageWidth);
            const bh = clamp(h * scaleY, 1, imageHeight);

            candidates.push({
                name: className,
                confidence: bestScore,
                bbox: [x, y, bw, bh],
            });
        }

        const rawTopPredictions = rawPredictions
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);

        return {
            candidates,
            rawTopPredictions,
        };
    };

    const createYoloInputTensor = (
        ort: OnnxModule,
        imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
        inputWidth: number,
        inputHeight: number
    ) => {
        const canvas = document.createElement('canvas');
        canvas.width = inputWidth;
        canvas.height = inputHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas context not available for ONNX preprocessing');
        }

        ctx.drawImage(imageElement, 0, 0, inputWidth, inputHeight);
        const imageData = ctx.getImageData(0, 0, inputWidth, inputHeight).data;
        const chw = new Float32Array(3 * inputWidth * inputHeight);

        for (let i = 0; i < inputWidth * inputHeight; i++) {
            const r = imageData[i * 4] / 255;
            const g = imageData[i * 4 + 1] / 255;
            const b = imageData[i * 4 + 2] / 255;
            chw[i] = r;
            chw[inputWidth * inputHeight + i] = g;
            chw[2 * inputWidth * inputHeight + i] = b;
        }

        return new ort.Tensor('float32', chw, [1, 3, inputHeight, inputWidth]);
    };

    const loadYoloModel = useCallback(async (): Promise<boolean> => {
        try {
            const [ortModule, classesRes] = await Promise.all([
                import('onnxruntime-web'),
                fetch('/models/food-yolo/classes.json'),
            ]);

            if (!classesRes.ok) {
                throw new Error('Custom model classes not found at /models/food-yolo/classes.json');
            }

            const classesJson = await classesRes.json();
            const classMap: Record<number, string> = Object.entries(classesJson.classes || {}).reduce(
                (acc, [idx, name]) => {
                    acc[Number(idx)] = String(name).replace(/_/g, ' ');
                    return acc;
                },
                {} as Record<number, string>
            );

            const session = await ortModule.InferenceSession.create('/models/food-yolo/food_yolo.onnx', {
                executionProviders: ['webgl', 'wasm'],
            });

            const inputName = session.inputNames[0];
            const outputName = session.outputNames[0];
            const dims = (((session.inputMetadata[0] as any)?.dimensions) ?? []) as Array<number | string | undefined>;
            const inputHeight = Number(dims[2]) || 640;
            const inputWidth = Number(dims[3]) || 640;

            yoloRef.current = {
                ort: ortModule,
                session,
                inputName,
                outputName,
                inputWidth,
                inputHeight,
                classes: classMap,
            };

            return true;
        } catch (err) {
            console.warn('[Edge Vision] Failed to load custom food_yolo model, falling back to COCO-SSD:', err);
            yoloRef.current = null;
            return false;
        }
    }, []);

    /**
     * Load vision model (prefers custom food_yolo ONNX, falls back to COCO-SSD)
     */
    const loadModel = useCallback(async () => {
        if (isModelReady || isLoading) return; // Already loaded or loading

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
            if (isMountedRef.current) setLoadProgress(10);

            const hasCustomModel = await loadYoloModel();
            if (hasCustomModel) {
                if (isMountedRef.current) {
                    setLoadProgress(100);
                    setIsLoading(false);
                    setIsModelReady(true);
                    setModelSource('food-yolo');
                    console.log('✅ Edge Vision custom model loaded (food_yolo.onnx)');
                }
                return;
            }

            // Set backend to WebGL for better performance
            await tf.setBackend('webgl');
            await tf.ready();

            if (isMountedRef.current) setLoadProgress(20);

            // Model integrity verification
            // When model is self-hosted in /public/models/coco-ssd/, this will
            // validate SHA-256 hashes. For CDN-loaded models, it warns and proceeds.
            const integrityResult = await verifyModel('coco-ssd');
            if (!integrityResult.valid) {
                const isMissingManifest = integrityResult.errors.some(
                    e => e.includes('manifest not found') || e.includes('not found in manifest')
                );
                if (isMissingManifest) {
                    console.warn('[Edge Vision] Model integrity manifest not found — loading from CDN. ' +
                        'Self-host models in /public/models/coco-ssd/ and run npm run build:model-hashes for full verification.');
                } else {
                    // Manifest exists but hashes don't match — potential tampering
                    throw new Error(`Model integrity check failed: ${integrityResult.errors.join(', ')}`);
                }
            }

            if (isMountedRef.current) setLoadProgress(30);

            // Load COCO-SSD model (~5MB download)
            const loadedModel = await cocoSsd.load({
                base: 'lite_mobilenet_v2', // Smaller, faster model (~5MB)
            });

            if (isMountedRef.current) {
                setLoadProgress(100);
                setModel(loadedModel);
                setIsLoading(false);
                setIsModelReady(true);
                setModelSource('coco-ssd');
                console.log('✅ Edge Vision model loaded successfully');
            }
        } catch (err) {
            console.error('Failed to load Edge Vision model:', err);
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to load model');
                setIsLoading(false);
                setIsModelReady(false);
            }
        }
    }, [isModelReady, isLoading, checkSupport, loadYoloModel]);

    /**
     * Detect objects in image
     * @param imageElement - HTMLImageElement, HTMLVideoElement, or HTMLCanvasElement
     */
    const detect = useCallback(
        async (
            imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
        ): Promise<EdgeVisionResult> => {
            const yoloRuntime = yoloRef.current;
            if (!yoloRuntime && !model) {
                throw new Error('Model not loaded. Call loadModel() first.');
            }

            const startTime = performance.now();

            if (isMountedRef.current) {
                setIsAnalyzing(true);
                setError(null);
            }

            try {
                if (yoloRuntime) {
                    const inputTensor = createYoloInputTensor(
                        yoloRuntime.ort,
                        imageElement,
                        yoloRuntime.inputWidth,
                        yoloRuntime.inputHeight
                    );

                    const outputMap = await yoloRuntime.session.run({
                        [yoloRuntime.inputName]: inputTensor,
                    });

                    const outputTensor = outputMap[yoloRuntime.outputName];
                    if (!outputTensor || !(outputTensor.data instanceof Float32Array)) {
                        throw new Error('Unexpected ONNX output tensor format');
                    }

                    const imageWidth =
                        (imageElement as HTMLVideoElement).videoWidth ||
                        (imageElement as HTMLImageElement).naturalWidth ||
                        (imageElement as HTMLCanvasElement).width;
                    const imageHeight =
                        (imageElement as HTMLVideoElement).videoHeight ||
                        (imageElement as HTMLImageElement).naturalHeight ||
                        (imageElement as HTMLCanvasElement).height;

                    const parsed = parseYoloDetections(
                        outputTensor.data,
                        outputTensor.dims,
                        yoloRuntime.classes,
                        imageWidth,
                        imageHeight,
                        yoloRuntime.inputWidth,
                        yoloRuntime.inputHeight
                    );

                    const objects = nms(parsed.candidates).map((candidate) => ({
                        name: candidate.name,
                        confidence: candidate.confidence,
                        bbox: candidate.bbox,
                    }));

                    const processingTime = Math.round(performance.now() - startTime);
                    if (isMountedRef.current) {
                        setIsAnalyzing(false);
                    }

                    return {
                        objects,
                        processingTime,
                        rawCount: parsed.candidates.length,
                        rawTopPredictions: parsed.rawTopPredictions,
                    };
                }

                // Run detection
                const predictions = await model!.detect(imageElement);
                const rawTopPredictions = predictions
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5)
                    .map((pred) => ({
                        name: pred.class,
                        confidence: pred.score,
                    }));

                const objects: DetectedObject[] = predictions
                    .filter(pred => {
                        const normalizedClass = normalizeCocoClassName(pred.class, pred.score, predictions);
                        const isFood = FOOD_KEYWORDS.has(normalizedClass);
                        const relaxedConfidence = LOW_CONF_PRODUCE_CLASSES.has(normalizedClass) ? 0.15 : minConfidence;
                        const meetsConfidence = pred.score >= relaxedConfidence;
                        return isFood && meetsConfidence;
                    })
                    .map(pred => ({
                        name: normalizeCocoClassName(pred.class, pred.score, predictions),
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
                    rawCount: predictions.length,
                    rawTopPredictions,
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
        isModelReady,
        modelSource,
        isLoading,
        isAnalyzing,
        loadProgress,
        error,
        isSupported,
        loadModel,
        detect,
    };
}
