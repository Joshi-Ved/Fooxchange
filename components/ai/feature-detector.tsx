/**
 * AI Feature Detection Component
 * Shows users which AI features are available on their device
 */

'use client';

import { useEffect, useState } from 'react';
import { EdgeVisionService } from '@/lib/ai/edge-vision';
import { EdgeSearchService } from '@/lib/ai/edge-search';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

interface FeatureStatus {
    name: string;
    supported: boolean;
    description: string;
    fallback: string;
}

export function AIFeatureDetector() {
    const [features, setFeatures] = useState<FeatureStatus[]>([]);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        checkFeatures();
    }, []);

    async function checkFeatures() {
        setIsChecking(true);

        const featureChecks: FeatureStatus[] = [
            {
                name: 'Ingredient Scanning',
                supported: EdgeVisionService.isSupported(),
                description: 'AI-powered camera scanning to detect ingredients',
                fallback: 'Manual ingredient entry available'
            },
            {
                name: 'Semantic Search',
                supported: EdgeSearchService.isSupported(),
                description: 'Smart search that understands recipe context',
                fallback: 'Standard keyword search available'
            },
            {
                name: 'Offline AI',
                supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
                description: 'AI features work without internet connection',
                fallback: 'Requires internet connection'
            },
            {
                name: 'PWA Installation',
                supported: typeof window !== 'undefined' &&
                    window.matchMedia('(display-mode: standalone)').matches === false &&
                    'serviceWorker' in navigator,
                description: 'Install app for native-like experience',
                fallback: 'Use in browser mode'
            }
        ];

        setFeatures(featureChecks);
        setIsChecking(false);
    }

    if (isChecking) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                    <p className="text-sm text-gray-600">Checking AI features...</p>
                </div>
            </Card>
        );
    }

    const allSupported = features.every(f => f.supported);
    const someSupported = features.some(f => f.supported) && !allSupported;

    return (
        <Card className="p-6">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    {allSupported && (
                        <>
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                            <div>
                                <h3 className="font-semibold text-green-900">All AI Features Available</h3>
                                <p className="text-sm text-green-700">Your device supports all advanced features</p>
                            </div>
                        </>
                    )}
                    {someSupported && (
                        <>
                            <Info className="h-6 w-6 text-amber-600" />
                            <div>
                                <h3 className="font-semibold text-amber-900">Partial AI Support</h3>
                                <p className="text-sm text-amber-700">Some features are unavailable</p>
                            </div>
                        </>
                    )}
                    {!someSupported && !allSupported && (
                        <>
                            <XCircle className="h-6 w-6 text-red-600" />
                            <div>
                                <h3 className="font-semibold text-red-900">Limited AI Support</h3>
                                <p className="text-sm text-red-700">Consider using a modern browser</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-2 mt-4">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${feature.supported
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                        >
                            {feature.supported ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            ) : (
                                <XCircle className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${feature.supported ? 'text-green-900' : 'text-gray-700'
                                    }`}>
                                    {feature.name}
                                </p>
                                <p className="text-xs text-gray-600 mt-0.5">
                                    {feature.description}
                                </p>
                                {!feature.supported && (
                                    <p className="text-xs text-gray-500 mt-1 italic">
                                        → {feature.fallback}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {(!allSupported) && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                            <strong>Tip:</strong> For the best experience, use Chrome, Edge, or Safari on a modern device.
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}
