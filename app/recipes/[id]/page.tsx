import { notFound } from "next/navigation";
import { getRecipeById, isRecipeSaved } from "@/lib/actions/detail-actions";
import { CookMode } from "@/components/recipes/cook-mode";
import { SaveRecipeButton } from "@/components/recipes/save-recipe-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Clock,
    Users,
    ChefHat,
    ArrowLeft,
    Share2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

interface RecipeDetailPageProps {
    params: Promise<{
        id: string;
    }>;
}

export async function generateMetadata({
    params,
}: RecipeDetailPageProps): Promise<Metadata> {
    const { id } = await params;
    const recipe = await getRecipeById(id);

    if (!recipe) {
        return {
            title: "Recipe Not Found - Fooxchange",
        };
    }

    return {
        title: `${recipe.title} - Fooxchange`,
        description: recipe.description,
        openGraph: {
            title: recipe.title,
            description: recipe.description,
            images: recipe.imageUrl ? [recipe.imageUrl] : [],
        },
    };
}

export default async function RecipeDetailPage({
    params,
}: RecipeDetailPageProps) {
    const { id } = await params;
    const recipe = await getRecipeById(id);
    const { userId } = await auth();

    if (!recipe) {
        notFound();
    }

    // Check if current user has saved this recipe
    const isSaved = userId ? await isRecipeSaved(userId, id) : false;

    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    const difficultyColors = {
        EASY: "text-green-500 bg-green-50 dark:bg-green-950/20",
        MEDIUM: "text-orange-500 bg-orange-50 dark:bg-orange-950/20",
        HARD: "text-red-500 bg-red-50 dark:bg-red-950/20",
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section with Image */}
            <div className="relative h-[400px] w-full overflow-hidden bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-950/30 dark:to-rose-950/30">
                {recipe.imageUrl ? (
                    <Image
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        fill
                        className="object-cover"
                        priority
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <span className="text-9xl">🍽️</span>
                    </div>
                )}
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

                {/* Back Button */}
                <div className="absolute left-4 top-4">
                    <Link href="/recipes">
                        <Button variant="secondary" className="gap-2 rounded-full">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-5xl px-4 -mt-20 relative z-10 pb-12">
                {/* Recipe Header Card */}
                <Card className="mb-8 shadow-xl">
                    <CardContent className="p-8">
                        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                            <div className="flex-1">
                                <h1 className="text-4xl font-bold tracking-tight">
                                    {recipe.title}
                                </h1>
                                <p className="mt-3 text-lg text-muted-foreground">
                                    {recipe.description}
                                </p>

                                {/* Author Info */}
                                <div className="mt-6 flex items-center gap-3">
                                    {recipe.author.avatarUrl ? (
                                        <Image
                                            src={recipe.author.avatarUrl}
                                            alt={recipe.author.name}
                                            width={48}
                                            height={48}
                                            className="rounded-full"
                                        />
                                    ) : (
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-lg font-bold text-white">
                                            {recipe.author.name.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold">{recipe.author.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {recipe.author.bio || "Home Chef"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-3">
                                <SaveRecipeButton
                                    recipeId={recipe.id}
                                    initialSaved={isSaved}
                                    initialCount={recipe._count.savedBy}
                                />
                                <Button variant="outline" className="gap-2 rounded-full">
                                    <Share2 className="h-5 w-5" />
                                    Share
                                </Button>
                            </div>
                        </div>

                        {/* Meta Info */}
                        <div className="mt-8 flex flex-wrap gap-4 border-t pt-6">
                            {totalTime > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                        <Clock className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{totalTime} mins</p>
                                        <p className="text-xs text-muted-foreground">Total time</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                    <Users className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{recipe.servings}</p>
                                    <p className="text-xs text-muted-foreground">Servings</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full ${difficultyColors[recipe.difficulty]}`}
                                >
                                    <ChefHat className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium capitalize">
                                        {recipe.difficulty.toLowerCase()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Difficulty</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-8 md:grid-cols-3">
                    {/* Ingredients */}
                    <Card className="md:col-span-1">
                        <CardContent className="p-6">
                            <h2 className="mb-4 text-2xl font-bold">Ingredients</h2>
                            <ul className="space-y-3">
                                {recipe.ingredients.map((ri) => (
                                    <li
                                        key={ri.id}
                                        className="flex items-start gap-3 text-sm leading-relaxed"
                                    >
                                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-500" />
                                        <div className="flex-1">
                                            <span className="font-medium">{ri.amount}</span>{" "}
                                            <span className="text-muted-foreground">
                                                {ri.ingredient.name}
                                            </span>
                                            {ri.isOptional && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    (optional)
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Steps */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold">Instructions</h2>
                            {recipe.steps.length > 0 && (
                                <CookMode steps={recipe.steps} recipeName={recipe.title} />
                            )}
                        </div>

                        <div className="space-y-6">
                            {recipe.steps.map((step) => (
                                <Card key={step.id}>
                                    <CardContent className="p-6">
                                        <div className="flex gap-4">
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-lg font-bold text-white">
                                                {step.order}
                                            </div>
                                            <div className="flex-1">
                                                <p className="leading-relaxed">{step.content}</p>
                                                {step.imageUrl && (
                                                    <div className="relative mt-4 h-48 w-full overflow-hidden rounded-lg">
                                                        <Image
                                                            src={step.imageUrl}
                                                            alt={`Step ${step.order}`}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
