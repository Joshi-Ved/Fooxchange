'use client';

/**
 * AI Recipe Recommendations Component
 * Displays intelligent recipe suggestions based on user context
 */

import { useState } from 'react';
import { Sparkles, Clock, Heart, ChefHat, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Recommendation {
    recipe: any;
    score: number;
    reason: string;
    category: 'quick' | 'healthy' | 'comfort' | 'gourmet';
}

interface AIRecommendationsProps {
    ingredients: string[];
    preferences?: {
        availableTime?: number;
        spiceLevel?: string;
        cuisinePreferences?: string[];
        dietaryRestrictions?: string[];
    };
}

const categoryIcons = {
    quick: Clock,
    healthy: Heart,
    comfort: ChefHat,
    gourmet: Sparkles,
};

const categoryColors = {
    quick: 'bg-blue-100 text-blue-700 border-blue-200',
    healthy: 'bg-green-100 text-green-700 border-green-200',
    comfort: 'bg-orange-100 text-orange-700 border-orange-200',
    gourmet: 'bg-purple-100 text-purple-700 border-purple-200',
};

export function AIRecommendations({ ingredients, preferences }: AIRecommendationsProps) {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const getRecommendations = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/ai/recommend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ingredients,
                    preferences,
                    limit: 6,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get recommendations');
            }

            const data = await response.json();
            setRecommendations(data.recommendations);
        } catch (err) {
            console.error('Recommendation error:', err);
            setError('Failed to load recommendations');
        } finally {
            setLoading(false);
        }
    };

    if (ingredients.length === 0) {
        return (
            <Card className="p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">AI-Powered Recommendations</h3>
                <p className="text-sm text-muted-foreground">
                    Add ingredients to get personalized recipe suggestions
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">AI Recommendations</h3>
                </div>
                <Button onClick={getRecommendations} disabled={loading}>
                    {loading ? 'Analyzing...' : 'Get Suggestions'}
                </Button>
            </div>

            {/* Error state */}
            {error && (
                <Card className="p-4 border-red-200 bg-red-50">
                    <p className="text-sm text-red-700">{error}</p>
                </Card>
            )}

            {/* Loading state */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="p-4 animate-pulse">
                            <div className="h-40 bg-gray-200 rounded-lg mb-4" />
                            <div className="h-4 bg-gray-200 rounded mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-2/3" />
                        </Card>
                    ))}
                </div>
            )}

            {/* Recommendations */}
            {!loading && recommendations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recommendations.map((rec, idx) => {
                        const Icon = categoryIcons[rec.category];
                        const colorClass = categoryColors[rec.category];

                        return (
                            <Link
                                key={idx}
                                href={`/recipes/${rec.recipe.id}`}
                                className="group"
                            >
                                <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 h-full">
                                    {/* Recipe Image */}
                                    <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5">
                                        {rec.recipe.imageUrl ? (
                                            <img
                                                src={rec.recipe.imageUrl}
                                                alt={rec.recipe.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ChefHat className="w-16 h-16 text-primary/30" />
                                            </div>
                                        )}

                                        {/* Category badge */}
                                        <div className="absolute top-2 right-2">
                                            <Badge
                                                variant="secondary"
                                                className={`${colorClass} flex items-center gap-1`}
                                            >
                                                <Icon className="w-3 h-3" />
                                                {rec.category}
                                            </Badge>
                                        </div>

                                        {/* Match score */}
                                        <div className="absolute top-2 left-2">
                                            <Badge variant="secondary" className="bg-black/70 text-white">
                                                <TrendingUp className="w-3 h-3 mr-1" />
                                                {Math.round(rec.score * 100)}% match
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Recipe Info */}
                                    <div className="p-4">
                                        <h4 className="font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                            {rec.recipe.title}
                                        </h4>

                                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                            {rec.reason}
                                        </p>

                                        {/* Recipe Meta */}
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            {rec.recipe.prepTime && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {rec.recipe.prepTime + rec.recipe.cookTime} min
                                                </div>
                                            )}
                                            {rec.recipe.author && (
                                                <div className="flex items-center gap-1">
                                                    <span>by {rec.recipe.author.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Empty state */}
            {!loading && recommendations.length === 0 && ingredients.length > 0 && (
                <Card className="p-8 text-center">
                    <p className="text-muted-foreground">
                        No recommendations yet. Click "Get Suggestions" to start!
                    </p>
                </Card>
            )}
        </div>
    );
}
