'use client';

/**
 * Camera Scanner Component - SECURE Edge AI Version
 * Real-time ingredient detection using client-side TensorFlow.js
 *
 * Security Features:
 * - Zero API calls (all processing client-side)
 * - No data leaves device
 * - Graceful degradation for unsupported devices
 * - Proper error handling
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, CheckCircle, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEdgeVision } from '@/lib/hooks/use-edge-vision';

interface DetectedIngredient {
    name: string;
    quantity?: string;
    unit?: string;
    confidence: number;
    databaseMatches?: any[];
}

interface CameraScannerProps {
    onIngredientsDetected: (ingredients: DetectedIngredient[]) => void;
    onClose: () => void;
}

export function CameraScanner({ onIngredientsDetected, onClose }: CameraScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string>('');
    const [detectedItems, setDetectedItems] = useState<DetectedIngredient[]>([]);
    const [processingTime, setProcessingTime] = useState<number>(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Edge AI Vision hook
    const {
        isLoading: modelLoading,
        isSupported,
        loadProgress,
        error: modelError,
        loadModel,
        detect,
    } = useEdgeVision({ minConfidence: 0.6 });

    // Load model when camera starts
    useEffect(() => {
        if (hasPermission && !modelLoading) {
            loadModel();
        }
    }, [hasPermission, modelLoading, loadModel]);

    // Start camera
    const startCamera = useCallback(async () => {
        // Check device support first
        if (!isSupported) {
            setError('Your device doesn\'t support AI scanning. This feature requires WebGL and WebAssembly.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera on mobile
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
            // Capture frame from video
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (!context) throw new Error('Canvas context not available');

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw current video frame to canvas
            context.drawImage(video, 0, 0);

            // Run Edge AI detection directly on canvas (no API call!)
            const result = await detect(canvas);

            // Convert detected objects to ingredients format
            const ingredients: DetectedIngredient[] = result.objects.map(obj => ({
                name: obj.name,
                confidence: obj.confidence,
                quantity: undefined,
                unit: undefined,
            }));

            setDetectedItems(ingredients);
            setProcessingTime(result.processingTime);

            // Auto-confirm high-confidence results
            const highConfidenceItems = ingredients.filter(
                (item) => item.confidence > 0.75
            );

            if (highConfidenceItems.length > 0) {
                setTimeout(() => {
                    onIngredientsDetected(ingredients);
                }, 2000); // Show results for 2 seconds before closing
            } else if (ingredients.length === 0) {
                setError('No food items detected. Try getting closer or improving lighting.');
            }
        } catch (err) {
            console.error('Scanning error:', err);
            setError(err instanceof Error ? err.message : 'Failed to scan ingredients');
        } finally {
            setIsScanning(false);
        }
    }, [detect, onIngredientsDetected]);

    // Cleanup on unmount
    const handleClose = useCallback(() => {
        stopCamera();
        onClose();
    }, [stopCamera, onClose]);

    return (
        <div className="fixed inset-0 z-50 bg-black">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Camera className="w-6 h-6" />
                        Scan Ingredients (Edge AI)
                    </h2>
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

            {/* Camera View */}
            <div className="relative w-full h-full flex items-center justify-center">
                {!hasPermission ? (
                    <Card className="max-w-md mx-4 p-6 text-center">
                        {!isSupported ? (
                            <>
                                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                                <h3 className="text-lg font-semibold mb-2">Device Not Supported</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Your device doesn't support AI-powered scanning.
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
                        {isScanning && !modelLoading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Card className="p-6 text-center">
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                                    <p className="text-sm font-medium">Analyzing ingredients...</p>
                                </Card>
                            </div>
                        )}

                        {/* Results overlay */}
                        {detectedItems.length > 0 && !isScanning && (
                            <div className="absolute bottom-20 left-4 right-4">
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
                                                <span className="font-medium capitalize">{item.name}</span>
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
                                </Card>
                            </div>
                        )}
                    </>
                )}

                {/* Error message */}
                {(error || modelError) && (
                    <div className="absolute bottom-20 left-4 right-4">
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
            {hasPermission && !isScanning && !modelLoading && (
                <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                    <Button
                        size="lg"
                        onClick={captureAndAnalyze}
                        className="rounded-full w-16 h-16 shadow-lg"
                    >
                        <Camera className="w-8 h-8" />
                    </Button>
                </div>
            )}
        </div>
    );
}
