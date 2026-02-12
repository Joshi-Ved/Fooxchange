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
import { Camera, X, CheckCircle, Loader2, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEdgeVision, type DetectedObject } from '@/lib/hooks/use-edge-vision';

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

export function CameraScanner({ onIngredientsDetected, onClose }: CameraScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [isContinuousMode, setIsContinuousMode] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string>('');
    const [detectedItems, setDetectedItems] = useState<DetectedIngredient[]>([]);
    const [processingTime, setProcessingTime] = useState<number>(0);
    const [fps, setFps] = useState<number>(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const continuousRef = useRef(false);
    const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });

    // Edge AI Vision hook
    const {
        isLoading: modelLoading,
        isSupported,
        loadProgress,
        error: modelError,
        loadModel,
        detect,
    } = useEdgeVision({ minConfidence: 0.5 });

    // Load model when camera starts
    useEffect(() => {
        if (hasPermission && !modelLoading) {
            loadModel();
        }
    }, [hasPermission, modelLoading, loadModel]);

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

    // Start camera
    const startCamera = useCallback(async () => {
        if (!isSupported) {
            setError('Your device doesn\'t support AI scanning. This feature requires WebGL and WebAssembly.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setHasPermission(true);
                setError('');
            }
        } catch (err) {
            console.error('Camera access error:', err);
            setError('Failed to access camera. Please grant camera permissions.');
        }
    }, [isSupported]);

    // Stop camera
    const stopCamera = useCallback(() => {
        continuousRef.current = false;
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
            const result = await detect(canvas);

            // Draw bounding boxes on overlay
            drawBoundingBoxes(result.objects, video.videoWidth, video.videoHeight);

            // Convert to ingredients format
            const ingredients: DetectedIngredient[] = result.objects.map(obj => ({
                name: obj.name,
                confidence: obj.confidence,
                bbox: obj.bbox,
                quantity: undefined,
                unit: undefined,
            }));

            setDetectedItems(ingredients);
            setProcessingTime(result.processingTime);

            // Update FPS counter
            fpsCounterRef.current.frames++;
            const now = Date.now();
            if (now - fpsCounterRef.current.lastTime >= 1000) {
                setFps(fpsCounterRef.current.frames);
                fpsCounterRef.current.frames = 0;
                fpsCounterRef.current.lastTime = now;
            }

            // Auto-confirm high-confidence results
            const highConfidenceItems = ingredients.filter(
                (item) => item.confidence > 0.75
            );

            if (!continuousRef.current && highConfidenceItems.length > 0) {
                setTimeout(() => {
                    onIngredientsDetected(ingredients);
                }, 2000);
            } else if (ingredients.length === 0 && !continuousRef.current) {
                setError('No food items detected. Try getting closer or improving lighting.');
            }
        } catch (err) {
            console.error('Scanning error:', err);
            setError(err instanceof Error ? err.message : 'Failed to scan ingredients');
        } finally {
            setIsScanning(false);
        }
    }, [detect, onIngredientsDetected, drawBoundingBoxes]);

    // Continuous detection mode (real-time YOLO-like scanning)
    const toggleContinuousMode = useCallback(() => {
        if (continuousRef.current) {
            continuousRef.current = false;
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
    }, []);

    const runContinuousDetection = useCallback(async () => {
        if (!continuousRef.current || !videoRef.current || !canvasRef.current) return;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            const result = await detect(canvas);
            drawBoundingBoxes(result.objects, video.videoWidth, video.videoHeight);

            const ingredients: DetectedIngredient[] = result.objects.map(obj => ({
                name: obj.name,
                confidence: obj.confidence,
                bbox: obj.bbox,
            }));
            setDetectedItems(ingredients);
            setProcessingTime(result.processingTime);

            // FPS
            fpsCounterRef.current.frames++;
            const now = Date.now();
            if (now - fpsCounterRef.current.lastTime >= 1000) {
                setFps(fpsCounterRef.current.frames);
                fpsCounterRef.current.frames = 0;
                fpsCounterRef.current.lastTime = now;
            }
        } catch {
            // Ignore errors in continuous mode
        }

        if (continuousRef.current) {
            requestAnimationFrame(runContinuousDetection);
        }
    }, [detect, drawBoundingBoxes]);

    // Cleanup on unmount
    const handleClose = useCallback(() => {
        continuousRef.current = false;
        stopCamera();
        onClose();
    }, [stopCamera, onClose]);

    // Confirm detected items and pass to parent
    const confirmDetections = useCallback(() => {
        if (detectedItems.length > 0) {
            onIngredientsDetected(detectedItems);
        }
    }, [detectedItems, onIngredientsDetected]);

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
                                    Go Back
                                </Button>
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
                        {detectedItems.length > 0 && !isScanning && (
                            <div className="absolute bottom-28 left-4 right-4">
                                <Card className="p-4 max-h-64 overflow-y-auto">
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
                                        <Button
                                            className="w-full mt-3"
                                            size="sm"
                                            onClick={confirmDetections}
                                        >
                                            Use These Ingredients
                                        </Button>
                                    )}
                                </Card>
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
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                    {/* Single capture button */}
                    <Button
                        size="lg"
                        onClick={captureAndAnalyze}
                        disabled={isScanning || isContinuousMode}
                        className="rounded-full w-16 h-16 shadow-lg"
                    >
                        <Camera className="w-8 h-8" />
                    </Button>

                    {/* Continuous/YOLO mode toggle */}
                    <Button
                        size="lg"
                        variant={isContinuousMode ? "destructive" : "secondary"}
                        onClick={toggleContinuousMode}
                        disabled={isScanning}
                        className="rounded-full w-16 h-16 shadow-lg"
                        title={isContinuousMode ? "Stop real-time scanning" : "Start real-time YOLO scanning"}
                    >
                        <RefreshCw className={`w-6 h-6 ${isContinuousMode ? 'animate-spin' : ''}`} />
                    </Button>

                    {/* Confirm button (when items detected in continuous mode) */}
                    {isContinuousMode && detectedItems.length > 0 && (
                        <Button
                            size="lg"
                            variant="default"
                            onClick={confirmDetections}
                            className="rounded-full w-16 h-16 shadow-lg bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="w-8 h-8" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
