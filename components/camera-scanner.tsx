'use client';

/**
 * Camera Scanner Component - SECURE Edge AI Version
 * Real-time ingredient detection using client-side TensorFlow.js
 * OpenCV-style bounding box drawing with YOLO-like detection display
 *
 * Security Features:
 * - Zero API calls (all processing client-side)
 * - No data leaves device
 * - Graceful degradation for unsupported devices
 * - Proper error handling
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, CheckCircle, Loader2, AlertCircle, AlertTriangle, RefreshCw, Sparkles, ChefHat, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEdgeVision, type DetectedObject } from '@/lib/hooks/use-edge-vision';
import Link from 'next/link';

interface DetectedIngredient {
    name: string;
    quantity?: string;
    unit?: string;
    confidence: number;
    bbox?: [number, number, number, number];
    databaseMatches?: any[];
}

interface CameraScannerProps {
    onIngredientsDetected: (ingredients: DetectedIngredient[]) => void;
    onClose: () => void;
}

// YOLO-style color palette for different detection classes
const BBOX_COLORS: Record<string, string> = {
    apple: '#FF3B30',
    banana: '#FFCC00',
    orange: '#FF9500',
    broccoli: '#34C759',
    carrot: '#FF6B35',
    'hot dog': '#AF52DE',
    pizza: '#FF2D55',
    donut: '#FF9FF3',
    cake: '#5856D6',
    sandwich: '#BF8B67',
    bread: '#D4A574',
    tomato: '#FF3B30',
    potato: '#C4A35A',
    lemon: '#FFF44F',
    lime: '#32CD32',
    default: '#00D4FF',
};

function getBBoxColor(className: string): string {
    return BBOX_COLORS[className.toLowerCase()] || BBOX_COLORS.default;
}

interface RecipeSuggestion {
    recipe: {
        id: string;
        title: string;
        description: string;
        imageUrl: string | null;
        prepTime: number | null;
        cookTime: number | null;
        difficulty: string;
    };
    matchPercent: number;
    reason: string;
}

export function CameraScanner({ onIngredientsDetected, onClose }: CameraScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [isContinuousMode, setIsContinuousMode] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string>('');
    const [detectedItems, setDetectedItems] = useState<DetectedIngredient[]>([]);
    const [rawTopPredictions, setRawTopPredictions] = useState<Array<{ name: string; confidence: number }>>([]);
    const [rawCount, setRawCount] = useState(0);
    const [processingTime, setProcessingTime] = useState<number>(0);
    const [fps, setFps] = useState<number>(0);

    // Recipe suggestions state
    const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const continuousRef = useRef(false);
    const isDetectingRef = useRef(false);
    const rafIdRef = useRef<number | null>(null);
    const autoConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastUiUpdateRef = useRef(0);
    const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });
    // Refs to avoid stale closures in continuous detection loop
    const detectRef = useRef<typeof detect>(null!);
    const drawBoundingBoxesRef = useRef<typeof drawBoundingBoxes>(null!);

    // Edge AI Vision hook
    const {
        isLoading: modelLoading,
        isSupported,
        loadProgress,
        error: modelError,
        loadModel,
        detect,
    } = useEdgeVision({ minConfidence: 0.5 });

    // Keep refs in sync with latest function references
    useEffect(() => {
        detectRef.current = detect;
    }, [detect]);

    // Load model when camera starts
    useEffect(() => {
        if (hasPermission && !modelLoading) {
            loadModel();
        }
    }, [hasPermission, modelLoading, loadModel]);

    // Lock body scroll while scanner is open to prevent background scroll jitter
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, []);

    /**
     * Draw OpenCV-style bounding boxes on the overlay canvas
     * Includes YOLO-style labels with confidence scores
     */
    const drawBoundingBoxes = useCallback((
        objects: DetectedObject[],
        videoWidth: number,
        videoHeight: number
    ) => {
        const overlay = overlayCanvasRef.current;
        if (!overlay) return;

        const ctx = overlay.getContext('2d');
        if (!ctx) return;

        // Match overlay size to video
        overlay.width = videoWidth;
        overlay.height = videoHeight;

        // Clear previous drawings
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        objects.forEach((obj) => {
            const [x, y, width, height] = obj.bbox;
            const color = getBBoxColor(obj.name);
            const confidence = Math.round(obj.confidence * 100);

            // --- OpenCV-style bounding box ---
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.setLineDash([]);

            // Draw rectangle
            ctx.strokeRect(x, y, width, height);

            // Corner accents (OpenCV-style thick corners)
            const cornerLen = Math.min(20, width * 0.15, height * 0.15);
            ctx.lineWidth = 5;

            // Top-left corner
            ctx.beginPath();
            ctx.moveTo(x, y + cornerLen);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerLen, y);
            ctx.stroke();

            // Top-right corner
            ctx.beginPath();
            ctx.moveTo(x + width - cornerLen, y);
            ctx.lineTo(x + width, y);
            ctx.lineTo(x + width, y + cornerLen);
            ctx.stroke();

            // Bottom-left corner
            ctx.beginPath();
            ctx.moveTo(x, y + height - cornerLen);
            ctx.lineTo(x, y + height);
            ctx.lineTo(x + cornerLen, y + height);
            ctx.stroke();

            // Bottom-right corner
            ctx.beginPath();
            ctx.moveTo(x + width - cornerLen, y + height);
            ctx.lineTo(x + width, y + height);
            ctx.lineTo(x + width, y + height - cornerLen);
            ctx.stroke();

            // --- YOLO-style label background ---
            const label = `${obj.name} ${confidence}%`;
            ctx.font = 'bold 14px monospace';
            const textMetrics = ctx.measureText(label);
            const labelHeight = 22;
            const labelWidth = textMetrics.width + 12;
            const labelY = y > labelHeight + 4 ? y - labelHeight - 4 : y;

            // Label background
            ctx.fillStyle = color;
            ctx.fillRect(x, labelY, labelWidth, labelHeight);

            // Label text
            ctx.fillStyle = '#FFFFFF';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x + 6, labelY + labelHeight / 2);

            // Confidence bar below label
            const barWidth = width * 0.6;
            const barHeight = 4;
            const barY = y > labelHeight + 8 ? y - 4 : y + labelHeight + 4;

            // Background bar
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(x, barY, barWidth, barHeight);

            // Filled bar
            ctx.fillStyle = color;
            ctx.fillRect(x, barY, barWidth * obj.confidence, barHeight);
        });

        // Draw scan info overlay (top-right)
        if (objects.length > 0) {
            const infoText = `${objects.length} item${objects.length > 1 ? 's' : ''} detected`;
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            const infoWidth = ctx.measureText(infoText).width + 16;
            ctx.fillRect(overlay.width - infoWidth - 8, 8, infoWidth, 24);
            ctx.fillStyle = '#00FF00';
            ctx.textBaseline = 'middle';
            ctx.fillText(infoText, overlay.width - infoWidth, 20);
        }
    }, []);

    // Keep drawBoundingBoxes ref in sync
    useEffect(() => {
        drawBoundingBoxesRef.current = drawBoundingBoxes;
    }, [drawBoundingBoxes]);

    // Start camera
    const startCamera = useCallback(async () => {
        if (!isSupported) {
            setError('Your device doesn\'t support AI scanning. This feature requires WebGL and WebAssembly.');
            return;
        }

        try {
            // Check if mediaDevices API is available (requires HTTPS or localhost)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setError(
                    `Camera API not available on this origin (${window.location.origin}). ` +
                    'Use HTTPS, or http://localhost in development.'
                );
                return;
            }

            const preferredConstraints: MediaStreamConstraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            };

            const fallbackConstraints: MediaStreamConstraints = {
                video: true,
            };

            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
            } catch (primaryErr) {
                // Desktop/laptop webcams often don't satisfy environment-facing constraints.
                stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                console.warn('[CameraScanner] Falling back to default camera constraints:', primaryErr);
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;

                // Ensure metadata is ready before enabling scan controls.
                await new Promise<void>((resolve) => {
                    const video = videoRef.current;
                    if (!video) {
                        resolve();
                        return;
                    }

                    if (video.readyState >= 1) {
                        resolve();
                        return;
                    }

                    const onLoaded = () => {
                        video.removeEventListener('loadedmetadata', onLoaded);
                        resolve();
                    };

                    video.addEventListener('loadedmetadata', onLoaded);
                });

                try {
                    await videoRef.current.play();
                } catch (playErr) {
                    console.warn('[CameraScanner] Autoplay required user gesture or failed:', playErr);
                }

                setHasPermission(true);
                setError('');
            }
        } catch (err: unknown) {
            console.error('Camera access error:', err);
            const domErr = err as DOMException;
            if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
                setError(
                    'Camera permission was denied. Please allow camera access in your browser settings: ' +
                    'click the lock/info icon in the address bar -> Site Settings -> Camera -> Allow, then reload.'
                );
            } else if (domErr.name === 'NotFoundError' || domErr.name === 'DevicesNotFoundError') {
                setError('No camera found on this device. Please connect a camera and try again.');
            } else if (domErr.name === 'NotReadableError' || domErr.name === 'TrackStartError') {
                setError('Camera is already in use by another application. Please close it and try again.');
            } else if (domErr.name === 'OverconstrainedError') {
                setError('Camera constraints were not supported on this device. Please retry to use the default camera.');
            } else {
                setError('Failed to access camera: ' + (domErr.message || 'Unknown error'));
            }
        }
    }, [isSupported]);

    // Stop camera
    const stopCamera = useCallback(() => {
        continuousRef.current = false;
        isDetectingRef.current = false;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (autoConfirmTimeoutRef.current) {
            clearTimeout(autoConfirmTimeoutRef.current);
            autoConfirmTimeoutRef.current = null;
        }
        setIsContinuousMode(false);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setHasPermission(false);
    }, []);

    // Capture and analyze image using Edge AI
    const captureAndAnalyze = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsScanning(true);
        setError('');

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (!context) throw new Error('Canvas context not available');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            // Run Edge AI detection directly on canvas
            const result = await detectRef.current(canvas);

            // Draw bounding boxes on overlay
            drawBoundingBoxesRef.current(result.objects, video.videoWidth, video.videoHeight);

            // Convert to ingredients format
            const ingredients: DetectedIngredient[] = result.objects.map(obj => ({
                name: obj.name,
                confidence: obj.confidence,
                bbox: obj.bbox,
                quantity: undefined,
                unit: undefined,
            }));

            setDetectedItems(ingredients);
            setRawTopPredictions(result.rawTopPredictions);
            setRawCount(result.rawCount);
            setProcessingTime(result.processingTime);

            // Update FPS counter
            fpsCounterRef.current.frames++;
            const now = Date.now();
            if (now - fpsCounterRef.current.lastTime >= 1000) {
                setFps(fpsCounterRef.current.frames);
                fpsCounterRef.current.frames = 0;
                fpsCounterRef.current.lastTime = now;
            }

            if (ingredients.length === 0 && !continuousRef.current) {
                if (result.rawCount > 0) {
                    setError('Model is detecting objects, but none matched ingredient classes. Check the top predictions below.');
                } else {
                    setError('No objects detected. Try getting closer or improving lighting.');
                }
            }
        } catch (err) {
            console.error('Scanning error:', err);
            setError(err instanceof Error ? err.message : 'Failed to scan ingredients');
        } finally {
            setIsScanning(false);
        }
    }, [onIngredientsDetected]);

    // Continuous detection mode (real-time YOLO-like scanning)
    const runContinuousDetection = useCallback(async () => {
        if (!continuousRef.current || !videoRef.current || !canvasRef.current) return;
        if (isDetectingRef.current) {
            rafIdRef.current = requestAnimationFrame(runContinuousDetection);
            return;
        }

        try {
            isDetectingRef.current = true;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            const result = await detectRef.current(canvas);
            drawBoundingBoxesRef.current(result.objects, video.videoWidth, video.videoHeight);

            const ingredients: DetectedIngredient[] = result.objects.map(obj => ({
                name: obj.name,
                confidence: obj.confidence,
                bbox: obj.bbox,
            }));
            const now = Date.now();
            if (now - lastUiUpdateRef.current > 140) {
                lastUiUpdateRef.current = now;
                setDetectedItems(ingredients);
                setRawTopPredictions(result.rawTopPredictions);
                setRawCount(result.rawCount);
                setProcessingTime(result.processingTime);
            }

            // FPS
            fpsCounterRef.current.frames++;
            if (now - fpsCounterRef.current.lastTime >= 1000) {
                setFps(fpsCounterRef.current.frames);
                fpsCounterRef.current.frames = 0;
                fpsCounterRef.current.lastTime = now;
            }
        } catch {
            // Ignore errors in continuous mode
        } finally {
            isDetectingRef.current = false;
        }

        if (continuousRef.current) {
            rafIdRef.current = requestAnimationFrame(runContinuousDetection);
        }
    }, []);

    const toggleContinuousMode = useCallback(() => {
        if (continuousRef.current) {
            continuousRef.current = false;
            isDetectingRef.current = false;
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            setIsContinuousMode(false);
            // Clear overlay
            const overlay = overlayCanvasRef.current;
            if (overlay) {
                const ctx = overlay.getContext('2d');
                ctx?.clearRect(0, 0, overlay.width, overlay.height);
            }
        } else {
            continuousRef.current = true;
            setIsContinuousMode(true);
            runContinuousDetection();
        }
    }, [runContinuousDetection]);

    // Cleanup on unmount
    const handleClose = useCallback(() => {
        continuousRef.current = false;
        isDetectingRef.current = false;
        stopCamera();
        onClose();
    }, [stopCamera, onClose]);

    // Confirm detected items and pass to parent
    const confirmDetections = useCallback(() => {
        if (detectedItems.length > 0) {
            onIngredientsDetected(detectedItems);
        }
    }, [detectedItems, onIngredientsDetected]);

    // Fetch recipe suggestions from the server based on detected ingredients
    const suggestRecipes = useCallback(async (ingredients: DetectedIngredient[]) => {
        if (ingredients.length === 0 || isFetchingSuggestions) return;
        setIsFetchingSuggestions(true);
        setShowSuggestions(true);
        setRecipeSuggestions([]);
        try {
            const res = await fetch('/api/ai/from-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    detectedIngredients: ingredients.map((i) => i.name),
                    limit: 5,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setRecipeSuggestions(data.data?.suggestions ?? []);
            } else if (res.status === 401) {
                setError('Sign in to get recipe suggestions.');
            }
        } catch {
            // non-fatal — suggestions panel just stays empty
        } finally {
            setIsFetchingSuggestions(false);
        }
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Camera className="w-6 h-6" />
                        Scan Ingredients (Edge AI)
                    </h2>
                    <div className="flex items-center gap-2">
                        {isContinuousMode && (
                            <span className="text-xs text-green-400 font-mono">
                                {fps} FPS | {processingTime}ms
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClose}
                            disabled={isFetchingSuggestions}
                            className="text-white hover:bg-white/20"
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Camera View */}
            <div className="relative w-full h-full flex items-center justify-center">
                {!hasPermission ? (
                    <Card className="max-w-md mx-4 p-6 text-center">
                        {!isSupported ? (
                            <>
                                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                                <h3 className="text-lg font-semibold mb-2">Device Not Supported</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Your device doesn&apos;t support AI-powered scanning.
                                    This feature requires WebGL and WebAssembly.
                                </p>
                                <Button onClick={handleClose} variant="outline" className="w-full">
                                    Go Back &amp; Type Ingredients Manually
                                </Button>
                            </>
                        ) : error ? (
                            <>
                                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                                <h3 className="text-lg font-semibold mb-2">Camera Access Issue</h3>
                                <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line">
                                    {error}
                                </p>
                                <div className="flex flex-col gap-2">
                                    <Button onClick={startCamera} className="w-full">
                                        Try Again
                                    </Button>
                                    <Button onClick={handleClose} variant="outline" className="w-full">
                                        Go Back &amp; Type Ingredients Manually
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Point your camera at ingredients to automatically identify them.
                                    All processing happens on your device - no data is sent to servers.
                                </p>
                                <Button onClick={startCamera} className="w-full">
                                    Enable Camera
                                </Button>
                            </>
                        )}
                    </Card>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        {/* OpenCV-style bounding box overlay */}
                        <canvas
                            ref={overlayCanvasRef}
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />

                        {/* Model loading overlay */}
                        {modelLoading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Card className="p-6 text-center">
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                                    <p className="text-sm font-medium">Loading AI model...</p>
                                    <p className="text-xs text-muted-foreground mt-2">{loadProgress}%</p>
                                </Card>
                            </div>
                        )}

                        {/* Scanning overlay */}
                        {isScanning && !modelLoading && !isContinuousMode && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Card className="p-6 text-center">
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                                    <p className="text-sm font-medium">Analyzing ingredients...</p>
                                </Card>
                            </div>
                        )}

                        {/* Results overlay */}
                        {detectedItems.length > 0 && !isScanning && !showSuggestions && (
                            <div className="absolute bottom-28 left-4 right-4 pointer-events-none">
                                <Card className="p-4 max-h-64 overflow-y-auto pointer-events-auto">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                        <p className="font-semibold">Detected Ingredients</p>
                                        <span className="text-xs text-muted-foreground ml-auto">
                                            {processingTime}ms (on-device)
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {detectedItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between text-sm"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="w-3 h-3 rounded-full inline-block"
                                                        style={{ backgroundColor: getBBoxColor(item.name) }}
                                                    />
                                                    <span className="font-medium capitalize">{item.name}</span>
                                                </div>
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded-full ${item.confidence > 0.75
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-yellow-100 text-yellow-700'
                                                        }`}
                                                >
                                                    {Math.round(item.confidence * 100)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {!isContinuousMode && (
                                        <div className="flex gap-2 mt-3">
                                            <Button
                                                className="flex-1"
                                                size="sm"
                                                variant="outline"
                                                disabled={isFetchingSuggestions}
                                                onClick={confirmDetections}
                                            >
                                                Use as Ingredients
                                            </Button>
                                            <Button
                                                className="flex-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600"
                                                size="sm"
                                                disabled={isFetchingSuggestions}
                                                onClick={() => suggestRecipes(detectedItems)}
                                            >
                                                <Sparkles className="w-3 h-3 mr-1" />
                                                Suggest Recipes
                                            </Button>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )}

                        {/* Diagnostic overlay when model detects non-ingredient objects */}
                        {detectedItems.length === 0 && rawCount > 0 && !isScanning && !showSuggestions && (
                            <div className="absolute bottom-28 left-4 right-4 pointer-events-none">
                                <Card className="p-4 pointer-events-auto border-amber-300 bg-amber-50">
                                    <div className="flex items-center gap-2 mb-2 text-amber-900">
                                        <AlertTriangle className="w-4 h-4" />
                                        <p className="text-sm font-semibold">Model is active, but no ingredient class matched</p>
                                    </div>
                                    <p className="text-xs text-amber-800 mb-2">
                                        Top model predictions ({rawCount} total):
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {rawTopPredictions.map((pred) => (
                                            <span
                                                key={`${pred.name}-${pred.confidence}`}
                                                className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded-full"
                                            >
                                                {pred.name} {Math.round(pred.confidence * 100)}%
                                            </span>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* Recipe Suggestions Panel */}
                        {showSuggestions && (
                            <div className="absolute inset-0 bg-black/90 overflow-y-auto overscroll-contain">
                                <div className="p-4 pt-16">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-orange-400" />
                                            Recipe Suggestions
                                        </h3>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={isFetchingSuggestions}
                                            className="text-white hover:bg-white/20"
                                            onClick={() => setShowSuggestions(false)}
                                        >
                                            Back to Camera
                                        </Button>
                                    </div>

                                    <p className="text-white/60 text-xs mb-4">
                                        Based on: {detectedItems.map((i) => i.name).join(', ')}
                                    </p>

                                    {isFetchingSuggestions ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center text-white">
                                                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 text-orange-400" />
                                                <p className="text-sm">Finding matching recipes…</p>
                                            </div>
                                        </div>
                                    ) : recipeSuggestions.length === 0 ? (
                                        <div className="text-center text-white/60 py-12">
                                            <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                            <p className="text-sm">No recipes found for these ingredients.</p>
                                            <p className="text-xs mt-1">Try scanning more items or adding recipes to the app.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {recipeSuggestions.map((s) => (
                                                <Card key={s.recipe.id} className="p-4 bg-white/10 border-white/20 text-white">
                                                    <div className="flex items-start gap-3">
                                                        {s.recipe.imageUrl ? (
                                                            <img
                                                                src={s.recipe.imageUrl}
                                                                alt={s.recipe.title}
                                                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-2xl">
                                                                🍽️
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="font-semibold text-sm leading-tight">{s.recipe.title}</h4>
                                                            <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{s.reason}</p>
                                                            <div className="flex items-center gap-3 mt-2 text-xs text-white/60">
                                                                {s.recipe.prepTime && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        {(s.recipe.prepTime || 0) + (s.recipe.cookTime || 0)} min
                                                                    </span>
                                                                )}
                                                                {s.matchPercent > 0 && (
                                                                    <span className="px-1.5 py-0.5 bg-green-500/30 text-green-300 rounded-full">
                                                                        {s.matchPercent}% match
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button asChild size="sm" variant="ghost" className="text-orange-400 hover:bg-white/10 p-1">
                                                            <Link href={`/recipes/${s.recipe.id}`} onClick={handleClose}>
                                                                <ExternalLink className="w-4 h-4" />
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-4 flex gap-2">
                                        <Button
                                            className="flex-1"
                                            variant="outline"
                                            disabled={isFetchingSuggestions}
                                            onClick={confirmDetections}
                                        >
                                            Add Ingredients to Recipe
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Error message */}
                {(error || modelError) && (
                    <div className="absolute bottom-28 left-4 right-4">
                        <Card className="p-4 border-red-200 bg-red-50">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="w-5 h-5" />
                                <p className="text-sm font-medium">{error || modelError}</p>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Controls */}
            {hasPermission && !modelLoading && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 px-4">
                    {/* Single capture button */}
                    <Button
                        size="sm"
                        onClick={captureAndAnalyze}
                        disabled={isScanning || isContinuousMode || isFetchingSuggestions}
                        className="shadow-lg"
                    >
                        <Camera className="mr-2 h-4 w-4" />
                        Scan Once
                    </Button>

                    {/* Continuous/YOLO mode toggle */}
                    <Button
                        size="sm"
                        variant={isContinuousMode ? "destructive" : "secondary"}
                        onClick={toggleContinuousMode}
                        disabled={isScanning || isFetchingSuggestions}
                        className="shadow-lg"
                        title={isContinuousMode ? "Stop real-time scanning" : "Start real-time YOLO scanning"}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isContinuousMode ? 'animate-spin' : ''}`} />
                        {isContinuousMode ? 'Stop Live Scan' : 'Start Live Scan'}
                    </Button>

                    {/* Confirm button (when items detected in continuous mode) */}
                    {isContinuousMode && detectedItems.length > 0 && (
                        <>
                            <Button
                                size="sm"
                                variant="default"
                                onClick={confirmDetections}
                                disabled={isFetchingSuggestions}
                                className="shadow-lg bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Use Detected
                            </Button>
                            <Button
                                size="sm"
                                variant="default"
                                disabled={isFetchingSuggestions}
                                onClick={() => suggestRecipes(detectedItems)}
                                className="shadow-lg bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600"
                            >
                                <Sparkles className="mr-2 h-4 w-4" />
                                Recipes
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
