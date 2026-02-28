"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Clock, ChefHat } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RecipeCard as RecipeCardType } from "@/lib/actions/feed-actions";

interface RecipeCardProps {
    recipe: RecipeCardType;
    onSave?: (recipeId: string) => void;
    isSaved?: boolean;
}

export function RecipeCard({ recipe, onSave, isSaved = false }: RecipeCardProps) {
    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    const difficultyColors = {
        EASY: "text-green-500",
        MEDIUM: "text-orange-500",
        HARD: "text-red-500",
    };

    return (
        <Card className="group cursor-pointer overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1">
            <Link href={`/recipes/${recipe.id}`}>
                {/* Recipe Image */}
                <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-950/30 dark:to-rose-950/30">
                    {recipe.imageUrl ? (
                        <Image
                            src={recipe.imageUrl}
                            alt={recipe.title}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-6xl">
                            🍽️
                        </div>
                    )}
                    {/* Difficulty Badge */}
                    <div className="absolute top-3 left-3">
                        <span className={`inline-flex items-center rounded-full bg-background/80 px-3 py-1 text-xs font-semibold backdrop-blur-sm ${difficultyColors[recipe.difficulty]}`}>
                            {recipe.difficulty}
                        </span>
                    </div>
                </div>
            </Link>

            <CardContent className="p-5">
                <Link href={`/recipes/${recipe.id}`}>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="line-clamp-1 text-lg font-semibold transition-colors group-hover:text-orange-500">
                                {recipe.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                by {recipe.author.name}
                            </p>
                        </div>
                    </div>

                    {/* Ingredients Preview */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {recipe.ingredients.slice(0, 3).map((ingredient, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                            >
                                {ingredient.name}
                            </span>
                        ))}
                        {recipe.ingredients.length > 3 && (
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                +{recipe.ingredients.length - 3} more
                            </span>
                        )}
                    </div>

                    {/* Meta Info */}
                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                            {totalTime > 0 && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {totalTime} min
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <ChefHat className="h-4 w-4" />
                                {recipe.difficulty.toLowerCase()}
                            </span>
                        </div>
                    </div>
                </Link>

                {/* Save button outside Link to avoid nested interactive elements */}
                <div className="mt-2 flex justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1 ${isSaved ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}
                        onClick={() => onSave?.(recipe.id)}
                    >
                        <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                        {recipe._count.savedBy}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
