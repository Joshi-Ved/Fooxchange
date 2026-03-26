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
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [isStartingCamera, setIsStartingCamera] = useState(false);
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
    const startAttemptRef = useRef(0);
    const autoScanTriggeredRef = useRef(false);
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
    } = useEdgeVision({ minConfidence: 0.35 });

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
        if (isStartingCamera) return;
        console.log('[CameraScanner] startCamera called');
        if (isSupported === false) {
            setError('Your device doesn\'t support AI scanning. This feature requires WebGL and WebAssembly.');
            return;
        }

        const attemptId = Date.now();
        startAttemptRef.current = attemptId;

        try {
            setIsStartingCamera(true);
            setError('');
            setDetectedItems([]);
            setRawTopPredictions([]);
            setRawCount(0);
            setShowSuggestions(false);
            setRecipeSuggestions([]);
            setIsVideoReady(false);
            autoScanTriggeredRef.current = false;

            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            // Check if mediaDevices API is available (requires HTTPS or localhost)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setError(
                    `Camera API not available on this origin (${window.location.origin}). ` +
                    'Use HTTPS, or http://localhost in development.'
                );
                return;
            }

            // Use broad default constraints first for maximum compatibility.
            const defaultConstraints: MediaStreamConstraints = {
                audio: false,
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            };

            let stream = await navigator.mediaDevices.getUserMedia(defaultConstraints);

            // Optional best-effort tweak: prefer back camera where supported.
            try {
                const track = stream.getVideoTracks()[0];
                if (track && typeof track.applyConstraints === 'function') {
                    await track.applyConstraints({
                        facingMode: { ideal: 'environment' },
                    });
                }
            } catch (constraintErr) {
                console.warn('[CameraScanner] Could not apply environment-facing preference:', constraintErr);
            }

            console.log('[CameraScanner] Stream obtained, video ref exists:', !!videoRef.current);
            
            if (!videoRef.current) {
                console.error('[CameraScanner] Video ref is null!');
                stream.getTracks().forEach((track) => track.stop());
                setError('Video element not available. Please try reloading the page.');
                return;
            }

            const video = videoRef.current;
            video.srcObject = stream;
            streamRef.current = stream;
            video.muted = true;
            video.autoplay = true;
            video.playsInline = true;
            video.setAttribute('playsinline', 'true');
            video.setAttribute('muted', 'true');

            // Reveal the video element immediately once a stream is attached.
            setHasPermission(true);

            const waitForReady = new Promise<void>((resolve, reject) => {
                const timeoutMs = 5000;
                const eventNames: Array<keyof HTMLMediaElementEventMap> = ['loadedmetadata', 'loadeddata', 'canplay', 'playing'];
                const timer = window.setTimeout(() => {
                    cleanup();
                    reject(new Error('Timed out waiting for camera preview to start'));
                }, timeoutMs);

                const checkReady = () => {
                    if (!videoRef.current) return;
                    if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                        cleanup();
                        resolve();
                    }
                };

                // Some browsers keep readyState stale for a moment. Poll briefly as backup.
                const poll = window.setInterval(checkReady, 120);

                const cleanup = () => {
                    window.clearTimeout(timer);
                    window.clearInterval(poll);
                    eventNames.forEach((name) => video.removeEventListener(name, checkReady));
                };

                eventNames.forEach((name) => video.addEventListener(name, checkReady));
                checkReady();
            });

            try {
                await video.play();
                if (startAttemptRef.current !== attemptId) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                await waitForReady;

                // Final guard: ensure there is an active video track.
                const track = stream.getVideoTracks()[0];
                if (!track || track.readyState !== 'live') {
                    throw new Error('Camera track is not live. Please close other apps using the camera and retry.');
                }

                setIsVideoReady(true);
                console.log('[CameraScanner] Video playing successfully');
            } catch (playErr) {
                const activeTrack = stream.getVideoTracks()[0];
                // Some browsers delay metadata events but still provide a live stream.
                if (activeTrack && activeTrack.readyState === 'live') {
                    console.warn('[CameraScanner] Proceeding with live track fallback:', playErr);
                    setIsVideoReady(true);
                    return;
                }

                if (startAttemptRef.current !== attemptId) {
                    return;
                }

                console.warn('[CameraScanner] Failed to start video playback:', playErr);
                setError(
                    'Camera opened, but video preview failed to start. Tap "Try Again" and close other apps using the camera.'
                );
                stream.getTracks().forEach((track) => track.stop());
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
                streamRef.current = null;
                setHasPermission(false);
                setIsVideoReady(false);
                return;
            }

            console.log('[CameraScanner] Camera preview is live');
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
        } finally {
            if (startAttemptRef.current === attemptId) {
                setIsStartingCamera(false);
            }
        }
    }, [isSupported, isStartingCamera]);

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
        setIsVideoReady(false);
        setIsStartingCamera(false);
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
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                throw new Error('Camera preview is not ready yet. Please wait a moment and retry.');
            }

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

    // Auto-run one scan when camera + model become ready, so users immediately see detection.
    useEffect(() => {
        if (!hasPermission || !isVideoReady || modelLoading || isContinuousMode || isScanning || detectedItems.length > 0) {
            return;
        }
        if (autoScanTriggeredRef.current) {
            return;
        }

        autoScanTriggeredRef.current = true;
        const timer = window.setTimeout(() => {
            captureAndAnalyze();
        }, 650);

        return () => window.clearTimeout(timer);
    }, [hasPermission, isVideoReady, modelLoading, isContinuousMode, isScanning, detectedItems.length, captureAndAnalyze]);

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
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                return;
            }

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

    const buildDetectedSearchTerms = useCallback((ingredients: DetectedIngredient[]): string[] => {
        const aliasMap: Record<string, string[]> = {
            apple: ['tomato'],
            tomato: ['apple'],
            broccoli: ['cauliflower', 'cabbage', 'mixed vegetables'],
            carrot: ['chopped carrot', 'mixed vegetables'],
            onion: ['chopped onion'],
            potato: ['chopped potato'],
        };

        const terms = new Set<string>();
        ingredients.forEach((ingredient) => {
            const normalized = ingredient.name.toLowerCase().trim();
            if (!normalized) return;
            terms.add(normalized);

            const aliases = aliasMap[normalized] || [];
            aliases.forEach((alias) => terms.add(alias));
        });

        return Array.from(terms);
    }, []);

    // Fetch recipe suggestions from the server based on detected ingredients
    const suggestRecipes = useCallback(async (ingredients: DetectedIngredient[]) => {
        if (ingredients.length === 0 || isFetchingSuggestions) return;
        setIsFetchingSuggestions(true);
        setShowSuggestions(true);
        setRecipeSuggestions([]);
        try {
            const detectedIngredients = buildDetectedSearchTerms(ingredients);
            const res = await fetch('/api/ai/from-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    detectedIngredients,
                    limit: 5,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setRecipeSuggestions(data.data?.suggestions ?? []);
            } else if (res.status === 401) {
                setError('Sign in to get recipe suggestions.');
            }
        } catch (err) {
            console.error('Failed to fetch recipes:', err);
            // non-fatal — suggestions panel just stays empty
        } finally {
            setIsFetchingSuggestions(false);
        }
    }, [buildDetectedSearchTerms, isFetchingSuggestions]);

    // Auto-fetch recipes when ingredients are detected (fire-and-forget)
    useEffect(() => {
        if (detectedItems.length > 0 && !showSuggestions && !isFetchingSuggestions) {
            // Auto-fetch recipes after a short delay to let results page render first
            const timer = setTimeout(() => {
                suggestRecipes(detectedItems);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [detectedItems, showSuggestions, isFetchingSuggestions, suggestRecipes]);

    return (
        <div className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col">
            {/* Header */}
            <div className="relative z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Camera className="w-6 h-6" />
                        Scan Ingredients
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

            {/* Main Content Area */}
            <div className="flex-1 relative overflow-hidden flex">
                {/* Always render video/canvas elements so they're available immediately */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover bg-black ${
                        hasPermission ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                />
                <canvas ref={canvasRef} className="hidden" />
                {/* OpenCV-style bounding box overlay */}
                <canvas
                    ref={overlayCanvasRef}
                    className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-10 ${
                        hasPermission ? 'opacity-100' : 'opacity-0'
                    }`}
                />

                {!hasPermission ? (
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                        <Card className="max-w-md mx-4 p-6 text-center">
                        {isSupported === false ? (
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
                                    {isStartingCamera ? 'Starting Camera...' : 'Enable Camera'}
                                </Button>
                            </>
                        )}
                    </Card>
                    </div>
                ) : (
                    <>
                        {/* Live Camera Status Badge - Top left */}
                        <div className="absolute top-20 left-4 z-20 flex items-center gap-2 bg-black/70 px-3 py-2 rounded-lg">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-white text-xs font-medium">Live Preview</span>
                        </div>

                        {/* Live Camera Guidance Overlay - Transparent crosshair */}
                        {!showSuggestions && (
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-15">
                                {/* Transparent crosshair - should let camera show through */}
                                <div className="relative w-40 h-40 border-2 border-cyan-400/50 rounded-lg shadow-lg opacity-70">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-0.5 h-16 bg-cyan-400/60" />
                                        <div className="w-16 h-0.5 bg-cyan-400/60 absolute" />
                                    </div>
                                </div>
                                {/* Guidance text */}
                                <p className="text-white text-center mt-12 text-sm font-medium max-w-xs px-4 bg-black/50 py-2 rounded-lg">
                                    Point camera at ingredients
                                </p>
                                {isContinuousMode && (
                                    <p className="text-cyan-300 text-center text-xs mt-2 mx-4 bg-black/50 px-3 py-1 rounded-lg">
                                        🔍 Live scanning active • {detectedItems.length} detected
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Model loading overlay */}
                        {modelLoading && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
                                <Card className="p-6 text-center">
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                                    <p className="text-sm font-medium">Loading AI model...</p>
                                    <p className="text-xs text-muted-foreground mt-2">{loadProgress}%</p>
                                </Card>
                            </div>
                        )}

                        {/* Camera bootstrap hint (non-blocking) */}
                        {!isVideoReady && !modelLoading && (
                            <div className="absolute top-20 right-4 z-20 pointer-events-none">
                                <Card className="px-3 py-2 text-center bg-black/60 border-white/10">
                                    <p className="text-xs text-white/90">Starting live camera feed...</p>
                                </Card>
                            </div>
                        )}

                        {/* Scanning overlay */}
                        {isScanning && !modelLoading && !isContinuousMode && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40">
                                <Card className="p-6 text-center">
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                                    <p className="text-sm font-medium">Analyzing ingredients...</p>
                                </Card>
                            </div>
                        )}

                        {/* Results Page - Full overlay after detection */}
                        {detectedItems.length > 0 && !isScanning && !showSuggestions && (
                            <div className="absolute inset-0 bg-black/90 z-30 flex flex-col">
                                {/* Results Header */}
                                <div className="flex-shrink-0 border-b border-white/10 p-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <CheckCircle className="w-6 h-6 text-green-500" />
                                        Scan Results
                                    </h3>
                                </div>

                                {/* Detected Items Grid */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {detectedItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-white/10 border border-white/20 rounded-lg p-3 hover:bg-white/15 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span
                                                        className="w-4 h-4 rounded-full inline-block flex-shrink-0"
                                                        style={{ backgroundColor: getBBoxColor(item.name) }}
                                                    />
                                                    <span className="text-white font-semibold text-sm capitalize line-clamp-1">
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-white/60">Confidence</span>
                                                    <span className={`px-2 py-1 rounded-full ${
                                                        item.confidence > 0.75
                                                            ? 'bg-green-500/30 text-green-300'
                                                            : item.confidence > 0.5
                                                            ? 'bg-yellow-500/30 text-yellow-300'
                                                            : 'bg-orange-500/30 text-orange-300'
                                                    }`}>
                                                        {Math.round(item.confidence * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Scan Stats */}
                                    <div className="bg-white/5 rounded-lg p-3 mb-4 text-xs text-white/70 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Total Detected:</span>
                                            <span className="text-white font-medium">{detectedItems.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Processing Time:</span>
                                            <span className="text-white font-medium">{processingTime}ms</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex-shrink-0 border-t border-white/10 p-4 space-y-2">
                                    <Button
                                        size="sm"
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={confirmDetections}
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Use These Ingredients
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600"
                                        onClick={() => suggestRecipes(detectedItems)}
                                        disabled={isFetchingSuggestions}
                                    >
                                        {isFetchingSuggestions ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Finding Recipes...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Find Recipes
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => {
                                            setDetectedItems([]);
                                            const overlay = overlayCanvasRef.current;
                                            if (overlay) {
                                                const ctx = overlay.getContext('2d');
                                                ctx?.clearRect(0, 0, overlay.width, overlay.height);
                                            }
                                        }}
                                    >
                                        Scan Again
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Diagnostic overlay when model detects non-ingredient objects */}
                        {detectedItems.length === 0 && rawCount > 0 && !isScanning && !showSuggestions && !isContinuousMode && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none max-w-md z-20">
                                <Card className="p-4 pointer-events-auto border-amber-300 bg-amber-50">
                                    <div className="flex items-center gap-2 mb-2 text-amber-900">
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                        <p className="text-xs font-semibold">Objects detected • Not ingredients</p>
                                    </div>
                                    <p className="text-xs text-amber-800 mb-3">
                                        The camera sees these items. Try focusing on food:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {rawTopPredictions.slice(0, 4).map((pred) => (
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

                        {/* Recipe Suggestions Panel - Full screen overlay */}
                        {showSuggestions && (
                            <div className="absolute inset-0 bg-black/95 z-40 flex flex-col">
                                {/* Header */}
                                <div className="flex-shrink-0 border-b border-white/10 p-4 flex items-center justify-between">
                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                        <Sparkles className="w-6 h-6 text-orange-400 flex-shrink-0" />
                                        Recipe Suggestions
                                    </h3>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-white hover:bg-white/20 h-8 w-8 p-0"
                                        onClick={() => setShowSuggestions(false)}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Detected items summary */}
                                <div className="flex-shrink-0 bg-white/5 border-b border-white/10 p-3">
                                    <p className="text-xs text-white/60 mb-2">Based on detected ingredients:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {detectedItems.map((item, idx) => (
                                            <span
                                                key={idx}
                                                className="text-xs px-2.5 py-1 bg-white/10 text-white/90 rounded-full border border-white/10 capitalize"
                                            >
                                                {item.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Recipes content */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    {isFetchingSuggestions ? (
                                        <div className="flex flex-col items-center justify-center h-full">
                                            <Loader2 className="w-12 h-12 animate-spin text-orange-400 mb-3" />
                                            <p className="text-white text-center">Finding delicious recipes for you...</p>
                                        </div>
                                    ) : recipeSuggestions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center">
                                            <ChefHat className="w-16 h-16 text-white/30 mb-3" />
                                            <p className="text-white/80 text-sm font-medium mb-2">No recipes found</p>
                                            <p className="text-white/50 text-xs">Try different ingredients or check back later</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {recipeSuggestions.map((suggestion) => (
                                                <Link
                                                    href={`/recipes/${suggestion.recipe.id}`}
                                                    key={suggestion.recipe.id}
                                                    onClick={handleClose}
                                                    className="block"
                                                >
                                                    <Card className="bg-gradient-to-r from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 border-white/20 text-white overflow-hidden transition-all hover:shadow-lg cursor-pointer">
                                                        <div className="flex gap-3 p-3">
                                                            {/* Recipe Image */}
                                                            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
                                                                {suggestion.recipe.imageUrl ? (
                                                                    <img
                                                                        src={suggestion.recipe.imageUrl}
                                                                        alt={suggestion.recipe.title}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <span className="text-3xl">🍽️</span>
                                                                )}
                                                            </div>

                                                            {/* Recipe Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-sm mb-1 line-clamp-2 leading-tight">
                                                                    {suggestion.recipe.title}
                                                                </h4>
                                                                
                                                                <div className="flex flex-wrap gap-2 mb-2">
                                                                    {suggestion.matchPercent > 0 && (
                                                                        <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                                                                            <CheckCircle className="w-3 h-3" />
                                                                            {suggestion.matchPercent}% match
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-2 text-xs text-white/60">
                                                                    {suggestion.recipe.prepTime && suggestion.recipe.cookTime ? (
                                                                        <span className="flex items-center gap-1">
                                                                            <Clock className="w-3 h-3" />
                                                                            {(suggestion.recipe.prepTime + suggestion.recipe.cookTime)} min
                                                                        </span>
                                                                    ) : null}
                                                                    {suggestion.recipe.difficulty && (
                                                                        <span className="px-2 py-0.5 bg-white/10 rounded text-xs capitalize">
                                                                            {suggestion.recipe.difficulty}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Open Icon */}
                                                            <div className="flex-shrink-0 flex items-center justify-center">
                                                                <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white/70" />
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer buttons */}
                                <div className="flex-shrink-0 border-t border-white/10 p-4 space-y-2 bg-black/80">
                                    <Button
                                        className="w-full"
                                        variant="outline"
                                        onClick={() => {
                                            setShowSuggestions(false);
                                            setDetectedItems([]);
                                            const overlay = overlayCanvasRef.current;
                                            if (overlay) {
                                                const ctx = overlay.getContext('2d');
                                                ctx?.clearRect(0, 0, overlay.width, overlay.height);
                                            }
                                        }}
                                    >
                                        Back to Scan
                                    </Button>
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={confirmDetections}
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Use These Ingredients
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Error message - Top Area */}
                {(error || modelError) && !showSuggestions && (
                    <div className="absolute top-20 left-4 right-4 sm:right-auto pointer-events-none max-w-sm z-20">
                        <Card className="p-3 border-red-200 bg-red-50 pointer-events-auto">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm font-medium">{error || modelError}</p>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Controls - Bottom Bar */}
            {hasPermission && !modelLoading && !showSuggestions && !detectedItems.length && (
                <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-black/40 p-4 flex gap-2 justify-center flex-wrap z-20">
                    {/* Single capture button */}
                    <Button
                        size="lg"
                        onClick={captureAndAnalyze}
                        disabled={isScanning || isContinuousMode}
                        className="shadow-lg flex-1 max-w-xs"
                    >
                        <Camera className="mr-2 h-4 w-4" />
                        Scan Once
                    </Button>

                    {/* Continuous/YOLO mode toggle */}
                    <Button
                        size="lg"
                        variant={isContinuousMode ? "destructive" : "secondary"}
                        onClick={toggleContinuousMode}
                        disabled={isScanning}
                        className="shadow-lg flex-1 max-w-xs"
                        title={isContinuousMode ? "Stop real-time scanning" : "Start real-time scanning"}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isContinuousMode ? 'animate-spin' : ''}`} />
                        {isContinuousMode ? 'Stop Live' : 'Live Scan'}
                    </Button>
                </div>
            )}
        </div>
    );
}
