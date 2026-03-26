'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, AlertCircle, CheckCircle2, ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEdgeVision } from '@/lib/hooks/use-edge-vision';

export default function CameraCheckPage() {
	const [cameraError, setCameraError] = useState<string>('');
	const [hasCamera, setHasCamera] = useState(false);
	const [isStartingCamera, setIsStartingCamera] = useState(false);
	const [lastResult, setLastResult] = useState<{
		processingTime: number;
		rawCount: number;
		rawTopPredictions: Array<{ name: string; confidence: number }>;
		ingredientMatches: Array<{ name: string; confidence: number }>;
	} | null>(null);

	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const startAttemptRef = useRef(0);

	const {
		isLoading,
		isAnalyzing,
		isModelReady,
		modelSource,
		isSupported,
		loadProgress,
		error,
		loadModel,
		detect,
	} = useEdgeVision({ minConfidence: 0.2 });

	const startCamera = useCallback(async () => {
		if (isStartingCamera) return;
		setCameraError('');
		const attemptId = Date.now();
		startAttemptRef.current = attemptId;
		try {
			setIsStartingCamera(true);
			if (!navigator.mediaDevices?.getUserMedia) {
				setCameraError('Camera API is unavailable on this origin. Use localhost or HTTPS.');
				return;
			}

			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
				streamRef.current = null;
			}

			let stream: MediaStream;
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: { width: { ideal: 1280 }, height: { ideal: 720 } },
				});
			} catch {
				stream = await navigator.mediaDevices.getUserMedia({ video: true });
			}

			if (videoRef.current) {
				const video = videoRef.current;
				video.srcObject = stream;
				streamRef.current = stream;
				video.muted = true;
				video.autoplay = true;
				video.playsInline = true;
				video.setAttribute('playsinline', 'true');
				video.setAttribute('muted', 'true');

				await video.play();
				if (startAttemptRef.current !== attemptId) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}
				setHasCamera(true);
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to start camera';
			setCameraError(message);
		} finally {
			if (startAttemptRef.current === attemptId) {
				setIsStartingCamera(false);
			}
		}
	}, [isStartingCamera]);

	const stopCamera = useCallback(() => {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}
		setIsStartingCamera(false);
		setHasCamera(false);
	}, []);

	useEffect(() => {
		if (!hasCamera || isModelReady || isLoading) return;
		loadModel();
	}, [hasCamera, isModelReady, isLoading, loadModel]);

	const runSingleCheck = useCallback(async () => {
		if (!videoRef.current || !canvasRef.current) return;
		if (!isModelReady) {
			await loadModel();
		}

		const video = videoRef.current;
		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		ctx.drawImage(video, 0, 0);

		const result = await detect(canvas);
		setLastResult({
			processingTime: result.processingTime,
			rawCount: result.rawCount,
			rawTopPredictions: result.rawTopPredictions,
			ingredientMatches: result.objects.map((obj) => ({
				name: obj.name,
				confidence: obj.confidence,
			})),
		});
	}, [detect, isModelReady, loadModel]);

	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8">
			<div className="container max-w-4xl space-y-6">
				<Card className="p-6 space-y-4">
					<h1 className="text-2xl font-bold">Camera Integration Check</h1>
					<p className="text-sm text-muted-foreground">
						Use this page to verify camera access, model loading, and what the current vision model detects.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
						<div className="p-3 rounded-md border bg-background">
							<p className="font-semibold">Device Support</p>
							<p className={isSupported === null ? 'text-muted-foreground' : isSupported ? 'text-green-600' : 'text-red-600'}>
								{isSupported === null ? 'Checking...' : isSupported ? 'Supported' : 'Not supported'}
							</p>
						</div>
						<div className="p-3 rounded-md border bg-background">
							<p className="font-semibold">Camera Status</p>
							<p className={hasCamera ? 'text-green-600' : 'text-muted-foreground'}>
								{hasCamera ? 'Active' : 'Not active'}
							</p>
						</div>
						<div className="p-3 rounded-md border bg-background">
							<p className="font-semibold">Model Status</p>
							<p className={isLoading ? 'text-amber-600' : isModelReady ? 'text-green-600' : 'text-muted-foreground'}>
								{isLoading ? `Loading ${loadProgress}%` : isModelReady ? `Ready (${modelSource || 'unknown'})` : 'Not loaded'}
							</p>
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						<Button onClick={startCamera} disabled={hasCamera || isStartingCamera}>
							<Camera className="w-4 h-4 mr-2" />
							{isStartingCamera ? 'Starting Camera...' : 'Enable Camera'}
						</Button>
						<Button variant="outline" onClick={stopCamera} disabled={!hasCamera}>
							Stop Camera
						</Button>
						<Button variant="secondary" onClick={loadModel} disabled={isLoading}>
							{isLoading ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Loading Model
								</>
							) : (
								'Load Model'
							)}
						</Button>
						<Button
							onClick={runSingleCheck}
							disabled={!hasCamera || isAnalyzing || isLoading}
							className="bg-blue-600 hover:bg-blue-700"
						>
							{isAnalyzing ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Checking
								</>
							) : (
								<>
									<ScanSearch className="w-4 h-4 mr-2" />
									Run Detection Check
								</>
							)}
						</Button>
					</div>

					{(cameraError || error) && (
						<div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm flex items-start gap-2">
							<AlertCircle className="w-4 h-4 mt-0.5" />
							<p>{cameraError || error}</p>
						</div>
					)}
				</Card>

				<Card className="p-4 space-y-4">
					<h2 className="font-semibold">Live Preview</h2>
					<video ref={videoRef} autoPlay playsInline className="w-full h-[360px] object-cover rounded-md bg-black" />
					<canvas ref={canvasRef} className="hidden" />
				</Card>

				{lastResult && (
					<Card className="p-6 space-y-4">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="w-5 h-5 text-green-600" />
							<h3 className="font-semibold">Last Detection Result</h3>
						</div>
						<p className="text-sm text-muted-foreground">
							Processing time: {lastResult.processingTime}ms | Raw objects: {lastResult.rawCount} | Ingredient matches: {lastResult.ingredientMatches.length}
						</p>

						<div className="space-y-2">
							<p className="text-sm font-medium">Top Raw Predictions</p>
							<div className="flex flex-wrap gap-2">
								{lastResult.rawTopPredictions.length === 0 && (
									<span className="text-xs text-muted-foreground">No objects detected in frame.</span>
								)}
								{lastResult.rawTopPredictions.map((pred) => (
									<span key={`${pred.name}-${pred.confidence}`} className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-800">
										{pred.name} {Math.round(pred.confidence * 100)}%
									</span>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<p className="text-sm font-medium">Ingredient Class Matches</p>
							<div className="flex flex-wrap gap-2">
								{lastResult.ingredientMatches.length === 0 && (
									<span className="text-xs text-amber-700">No ingredient-class match in this frame. This means model may be working but class mapping did not match food labels.</span>
								)}
								{lastResult.ingredientMatches.map((pred) => (
									<span key={`${pred.name}-${pred.confidence}`} className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
										{pred.name} {Math.round(pred.confidence * 100)}%
									</span>
								))}
							</div>
						</div>
					</Card>
				)}
			</div>
		</div>
	);
}

