/**
 * AI Demo Page
 * Showcases Edge AI features (Vision & Search)
 */

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AIFeatureDetector } from '@/components/ai/feature-detector';
import { useEdgeVision } from '@/lib/ai';
import { useEdgeSearch } from '@/lib/ai';
import { Scan, Search, Sparkles, Zap } from 'lucide-react';

export default function AIDemoPage() {
    const vision = useEdgeVision();
    const search = useEdgeSearch();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);

    const handleSearchTest = async () => {
        if (!searchQuery.trim()) return;

        const embedding = await search.generateEmbedding(searchQuery);

        if (embedding) {
            setSearchResults([
                `✅ Generated ${embedding.dimensions}D embedding vector`,
                `⏱️ Processing time: ${embedding.processingTime.toFixed(0)}ms`,
                `📦 Model: ${embedding.modelVersion}`,
                `🔢 Sample values: [${embedding.vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`
            ]);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                        <Sparkles className="h-8 w-8 text-green-600" />
                        <h1 className="text-4xl font-bold text-gray-900">Edge AI Demo</h1>
                    </div>
                    <p className="text-gray-600">
                        Experience zero-cost, privacy-first AI running directly in your browser
                    </p>
                </div>

                {/* Feature Detection */}
                <AIFeatureDetector />

                {/* Vision Demo */}
                <Card className="p-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Scan className="h-6 w-6 text-green-600" />
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Edge Vision</h2>
                                <p className="text-sm text-gray-600">
                                    AI-powered ingredient detection
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${vision.isSupported ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-sm font-medium">
                                    {vision.isSupported ? 'Supported' : 'Not Supported'}
                                </span>
                            </div>
                            {vision.isSupported && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm text-gray-700">
                                            {vision.isInitialized ? 'Model Loaded' : 'Click to load model'}
                                        </span>
                                    </div>

                                    {!vision.isInitialized && (
                                        <Button
                                            onClick={vision.initialize}
                                            disabled={vision.isLoading}
                                            className="mt-2"
                                        >
                                            {vision.isLoading ? 'Loading Model...' : 'Initialize Vision AI'}
                                        </Button>
                                    )}

                                    {vision.isInitialized && (
                                        <div className="text-sm text-green-700 font-medium">
                                            ✅ Ready to scan ingredients!
                                        </div>
                                    )}

                                    {vision.error && (
                                        <div className="text-sm text-red-600">
                                            ❌ {vision.error}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                                <strong>🎯 How it works:</strong> Upload a photo of your ingredients,
                                and our AI will detect them using TensorFlow.js running directly in your browser.
                                No data is sent to any server!
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Search Demo */}
                <Card className="p-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Search className="h-6 w-6 text-green-600" />
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Edge Search</h2>
                                <p className="text-sm text-gray-600">
                                    Semantic search with local AI embeddings
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${search.isSupported ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-sm font-medium">
                                    {search.isSupported ? 'Supported' : 'Not Supported'}
                                </span>
                            </div>
                            {search.isSupported && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm text-gray-700">
                                            {search.isInitialized ? 'Model Loaded' : 'Ready to initialize'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {search.isSupported && (
                            <div className="space-y-3">
                                <Textarea
                                    placeholder="Try searching: 'healthy comfort food' or 'quick dinner ideas'"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    rows={3}
                                />
                                <Button
                                    onClick={handleSearchTest}
                                    disabled={search.isGenerating || !searchQuery.trim()}
                                    className="w-full"
                                >
                                    {search.isGenerating ? 'Generating Embedding...' : 'Test Semantic Search'}
                                </Button>

                                {searchResults.length > 0 && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <p className="text-sm font-semibold text-green-900 mb-2">
                                            Results:
                                        </p>
                                        <div className="space-y-1">
                                            {searchResults.map((result, i) => (
                                                <p key={i} className="text-sm text-green-800 font-mono">
                                                    {result}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {search.error && (
                                    <div className="text-sm text-red-600">
                                        ❌ {search.error}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                                <strong>🎯 How it works:</strong> Type any search query, and our AI will
                                convert it into a 384-dimensional vector using Transformers.js. This enables
                                semantic search that understands context, not just keywords!
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Benefits */}
                <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <h3 className="text-lg font-semibold text-green-900 mb-3">
                        ✨ Why Edge AI?
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex gap-3">
                            <div className="text-2xl">💰</div>
                            <div>
                                <p className="font-medium text-green-900">Zero Cost</p>
                                <p className="text-sm text-green-700">No API fees. Ever.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="text-2xl">🔒</div>
                            <div>
                                <p className="font-medium text-green-900">Privacy First</p>
                                <p className="text-sm text-green-700">Your data never leaves your device</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="text-2xl">⚡</div>
                            <div>
                                <p className="font-medium text-green-900">Lightning Fast</p>
                                <p className="text-sm text-green-700">No network latency</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="text-2xl">📱</div>
                            <div>
                                <p className="font-medium text-green-900">Offline Ready</p>
                                <p className="text-sm text-green-700">Works without internet</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
