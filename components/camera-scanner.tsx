'use client';

/**
 * Camera Scanner Component
 * Real-time ingredient detection using device camera and Edge AI (TensorFlow.js)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, CheckCircle, Loader2, AlertCircle, Zap, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEdgeVision, DetectedIngredient } from '@/lib/ai';

interface CameraScannerProps {
    onIngredientsDetected: (ingredients: DetectedIngredient[]) => void;
    onClose: () => void;
}

export function CameraScanner({ onIngredientsDetected, onClose }: CameraScannerProps) {
    const [hasPermission, setHasPermission] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);

    // Use the Edge Vision hook
    const {
        initialize,
        startVideoAnalysis,
        stopVideoAnalysis,
        isInitialized,
        isLoading: isModelLoading,
        isSupported: isAISupported,
        error: aiError,
        result: analysisResult
    } = useEdgeVision();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Initialize AI on mount
    useEffect(() => {
        initialize();
    }, [initialize]);

    // Start camera
    const startCamera = useCallback(async () => {
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

                // Wait for video to load metadata provided by the browser
                videoRef.current.onloadedmetadata = () => {
                    setIsStreaming(true);
                    if (videoRef.current) {
                        videoRef.current.play();

                        // Start AI analysis if initialized
                        if (isInitialized) {
                            startVideoAnalysis(videoRef.current, (result) => {
                                // Draw bounding boxes on canvas
                                drawBoundingBoxes(result.ingredients);
                            }, { fps: 5, minConfidence: 0.60 });
                        }
                    }
                };
            }
        } catch (err) {
            console.error('Camera access error:', err);
        }
    }, [isInitialized, startVideoAnalysis]);

    // Stop camera and AI
    const stopCamera = useCallback(() => {
        stopVideoAnalysis();

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setHasPermission(false);
        setIsStreaming(false);
    }, [stopVideoAnalysis]);

    // Draw bounding boxes
    const drawBoundingBoxes = (ingredients: DetectedIngredient[]) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!video || !canvas || !ctx) return;

        // Match canvas size to video size
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        // Clear previous drawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw boxes
        ingredients.forEach(item => {
            const [x, y, width, height] = item.bbox;

            // Draw box
            ctx.strokeStyle = '#22c55e'; // Green-500
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            // Draw label background
            ctx.fillStyle = '#22c55e';
            const text = `${item.name} ${Math.round(item.confidence * 100)}%`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x, y - 25, textWidth + 10, 25);

            // Draw label text
            ctx.fillStyle = 'white';
            ctx.font = '16px sans-serif';
            ctx.fillText(text, x + 5, y - 7);
        });
    };

    // Capture current detection
    const handleCapture = useCallback(() => {
        if (analysisResult && analysisResult.ingredients.length > 0) {
            // Confirm detected ingredients
            onIngredientsDetected(analysisResult.ingredients);
        } else {
            // No ingredients detected?
            // Maybe take a snapshot and run a single high-accuracy inference?
            // For now, just show a message or do nothing
        }
    }, [analysisResult, onIngredientsDetected]);

    // Cleanup on unmount
    const handleClose = useCallback(() => {
        stopCamera();
        onClose();
    }, [stopCamera, onClose]);

    // Cleanup effect
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    return (
        <div className="fixed inset-0 z-50 bg-black">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Camera className="w-6 h-6" />
                        Scan Ingredients
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
            <div className="relative w-full h-full flex items-center justify-center bg-black">
                {!hasPermission ? (
                    <Card className="max-w-md mx-4 p-6 text-center">
                        <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Point your camera at ingredients to automatically identify them using Edge AI.
                        </p>

                        {!isAISupported && (
                            <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
                                ⚠️ Your browser does not support on-device AI. Manual entry will be required.
                            </div>
                        )}

                        <Button onClick={startCamera} className="w-full" disabled={!isAISupported}>
                            Enable Camera
                        </Button>
                    </Card>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />

                        {/* Loading Overlay */}
                        {isModelLoading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                                <Card className="p-6 text-center">
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                                    <p className="text-sm font-medium">Loading Vision Model...</p>
                                    <p className="text-xs text-muted-foreground mt-1">This happens only once</p>
                                </Card>
                            </div>
                        )}

                        {/* Debug Info / HUD */}
                        <div className="absolute top-20 right-4 z-10 flex flex-col gap-2 items-end">
                            <div className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                                <Zap className="w-3 h-3 text-yellow-400" />
                                <span>Edge AI Active</span>
                            </div>
                            {analysisResult && (
                                <div className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                    {analysisResult.ingredients.length} items • {Math.round(analysisResult.processingTime)}ms
                                </div>
                            )}
                        </div>

                        {/* Real-time Results List (if items detected) */}
                        {analysisResult && analysisResult.ingredients.length > 0 && (
                            <div className="absolute bottom-24 left-4 right-4 max-h-40 overflow-y-auto space-y-2 pointer-events-none">
                                {analysisResult.ingredients.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="bg-white/90 backdrop-blur-md p-3 rounded-lg shadow-lg border border-green-200 flex items-center justify-between animate-in slide-in-from-bottom-5">
                                        <div className="flex items-center gap-2">
                                            <Box className="w-4 h-4 text-green-600" />
                                            <span className="font-semibold text-gray-900 capitalize">{item.name}</span>
                                        </div>
                                        <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                            {Math.round(item.confidence * 100)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Error message */}
                {aiError && (
                    <div className="absolute bottom-24 left-4 right-4">
                        <Card className="p-4 border-red-200 bg-red-50">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="w-5 h-5" />
                                <p className="text-sm font-medium">{aiError}</p>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Controls */}
            {hasPermission && (
                <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
                    <Button
                        size="lg"
                        onClick={handleCapture}
                        disabled={!analysisResult || analysisResult.ingredients.length === 0}
                        className={`rounded-full w-16 h-16 shadow-lg transition-all ${analysisResult && analysisResult.ingredients.length > 0
                                ? 'bg-green-600 hover:bg-green-700 scale-110 ring-4 ring-green-400/50'
                                : 'bg-white text-black hover:bg-gray-100'
                            }`}
                    >
                        {analysisResult && analysisResult.ingredients.length > 0 ? (
                            <CheckCircle className="w-8 h-8" />
                        ) : (
                            <Camera className="w-8 h-8" />
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
