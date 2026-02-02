"use client";

import { useState, useEffect } from "react";
import {
    getRecipes,
    searchRecipesByIngredients,
    RecipeCard as RecipeCardType,
} from "@/lib/actions/feed-actions";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { IngredientSearch } from "@/components/recipes/ingredient-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import Link from "next/link";

export default function RecipesPage() {
    const [recipes, setRecipes] = useState<RecipeCardType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

    // Load initial recipes
    useEffect(() => {
        loadRecipes();
    }, []);

    const loadRecipes = async () => {
        try {
            setLoading(true);
            const data = await getRecipes({ limit: 12 });
            setRecipes(data);
        } catch (error) {
            console.error("Error loading recipes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (ingredients: string[]) => {
        setSelectedIngredients(ingredients);

        if (ingredients.length === 0) {
            // Reset to all recipes
            loadRecipes();
            return;
        }

        try {
            setSearching(true);
            const data = await searchRecipesByIngredients(ingredients);
            setRecipes(data);
        } catch (error) {
            console.error("Error searching recipes:", error);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Browse Recipes
                        </h1>
                        <p className="mt-2 text-muted-foreground">
                            Discover delicious dishes from our community
                        </p>
                    </div>
                    <Link href="/recipes/create">
                        <Button className="gap-2 rounded-full">
                            <Plus className="h-5 w-5" />
                            Share Recipe
                        </Button>
                    </Link>
                </div>

                {/* Search Section */}
                <Card className="mt-8">
                    <CardContent className="p-6">
                        <h2 className="mb-4 text-lg font-semibold">
                            Search by ingredients
                        </h2>
                        <IngredientSearch onSearch={handleSearch} />
                    </CardContent>
                </Card>

                {/* Results */}
                {searching || loading ? (
                    <div className="mt-12 flex justify-center">
                        <div className="text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                {searching ? "Searching recipes..." : "Loading recipes..."}
                            </p>
                        </div>
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="mt-12 text-center">
                        <div className="mx-auto max-w-md">
                            <div className="mb-4 text-6xl">
                                {selectedIngredients.length > 0 ? "🔍" : "🍳"}
                            </div>
                            <h3 className="text-xl font-semibold">
                                {selectedIngredients.length > 0
                                    ? "No recipes found"
                                    : "No recipes yet"}
                            </h3>
                            <p className="mt-2 text-muted-foreground">
                                {selectedIngredients.length > 0
                                    ? "Try different ingredients or create a new recipe with these!"
                                    : "Be the first to share a delicious recipe with the community!"}
                            </p>
                            <Link href="/recipes/create">
                                <Button className="mt-6 gap-2 rounded-full">
                                    <Plus className="h-5 w-5" />
                                    {selectedIngredients.length > 0
                                        ? "Create Recipe"
                                        : "Create First Recipe"}
                                </Button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="mt-8 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {selectedIngredients.length > 0
                                    ? `Found ${recipes.length} recipe${recipes.length !== 1 ? "s" : ""} with ${selectedIngredients.join(", ")}`
                                    : `${recipes.length} recipe${recipes.length !== 1 ? "s" : ""} available`}
                            </p>
                        </div>
                        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {recipes.map((recipe) => (
                                <RecipeCard key={recipe.id} recipe={recipe} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
