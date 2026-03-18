"use client";

import { useState, useRef, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRecipe } from "@/lib/actions/recipe-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Clock, Users, ChefHat, ImageIcon, Camera, Upload } from "lucide-react";

// Lazy-load heavy components to prevent hydration failures
const CameraScanner = lazy(() =>
    import("@/components/camera-scanner").then((m) => ({ default: m.CameraScanner }))
);

// Difficulty options as simple strings (avoids importing @prisma/client on client)
const DIFFICULTY_OPTIONS = [
    { value: "EASY", label: "Easy" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HARD", label: "Hard" },
] as const;

export function CreateRecipeForm() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [prepTime, setPrepTime] = useState<number | undefined>();
    const [cookTime, setCookTime] = useState<number | undefined>();
    const [servings, setServings] = useState(4);
    const [difficulty, setDifficulty] = useState("EASY");

    // Dynamic arrays
    const [ingredients, setIngredients] = useState([
        { name: "", amount: "", isOptional: false },
    ]);
    const [steps, setSteps] = useState([{ content: "", imageUrl: "" }]);
    const [showCamera, setShowCamera] = useState(false);
    const [suggestedRecipes, setSuggestedRecipes] = useState<Array<{
        recipe: {
            id: string;
            title: string;
            imageUrl?: string | null;
        };
        reason?: string;
        matchPercent?: number;
    }>>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const titleCase = (value: string) =>
        value
            .split(" ")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

    const fetchSuggestionsFromDetected = async (ingredientNames: string[]) => {
        if (ingredientNames.length === 0) return;

        setIsFetchingSuggestions(true);
        setSuggestionError(null);
        try {
            const response = await fetch("/api/ai/from-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ detectedIngredients: ingredientNames, limit: 6 }),
            });

            if (response.status === 401) {
                setSuggestionError("Sign in to view recipe suggestions from scanned ingredients.");
                setSuggestedRecipes([]);
                return;
            }

            if (!response.ok) {
                setSuggestionError("Could not fetch recipe suggestions right now.");
                setSuggestedRecipes([]);
                return;
            }

            const data = await response.json();
            setSuggestedRecipes(data.data?.suggestions ?? []);
        } catch {
            setSuggestionError("Could not fetch recipe suggestions right now.");
            setSuggestedRecipes([]);
        } finally {
            setIsFetchingSuggestions(false);
        }
    };

    // Ingredient handlers
    const addIngredient = () => {
        setIngredients([...ingredients, { name: "", amount: "", isOptional: false }]);
    };

    const removeIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    const updateIngredient = (
        index: number,
        field: "name" | "amount" | "isOptional",
        value: string | boolean
    ) => {
        const updated = [...ingredients];
        updated[index] = { ...updated[index], [field]: value };
        setIngredients(updated);
    };

    // Step handlers
    const addStep = () => {
        setSteps([...steps, { content: "", imageUrl: "" }]);
    };

    const removeStep = (index: number) => {
        setSteps(steps.filter((_, i) => i !== index));
    };

    const updateStep = (
        index: number,
        field: "content" | "imageUrl",
        value: string
    ) => {
        const updated = [...steps];
        updated[index] = { ...updated[index], [field]: value };
        setSteps(updated);
    };

    // Handle file selection for recipe photo
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Revoke previous blob URL to avoid memory leak (MED-18)
            if (imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setImageUrl(url);
        }
    };

    // Form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Upload image file first if selected
            let finalImageUrl = imageUrl.startsWith('blob:') ? '' : imageUrl;

            if (imageFile) {
                try {
                    setUploadProgress('uploading');
                    setUploadError(null);
                    const formData = new FormData();
                    formData.append("file", imageFile);
                    const uploadRes = await fetch("/api/upload", {
                        method: "POST",
                        body: formData,
                    });
                    const data = await uploadRes.json();
                    if (uploadRes.ok) {
                        finalImageUrl = data.url;
                        setUploadProgress('done');
                    } else {
                        setUploadProgress('error');
                        setUploadError(data.error || "Image upload failed. The recipe will be saved without an image.");
                        finalImageUrl = "";
                    }
                } catch {
                    setUploadProgress('error');
                    setUploadError("Could not reach upload server. The recipe will be saved without an image.");
                    finalImageUrl = "";
                }
            }

            // detailed validation
            const validIngredients = ingredients.filter((ing) => ing.name.trim() !== "" && ing.amount.trim() !== "");
            if (validIngredients.length === 0) {
                setError("Please add at least one ingredient with both a name and amount.");
                setIsSubmitting(false);
                return;
            }

            const validSteps = steps.filter((step) => step.content.trim() !== "");
            if (validSteps.length === 0) {
                setError("Please add at least one cooking step.");
                setIsSubmitting(false);
                return;
            }

            const result = await createRecipe({
                title,
                description,
                imageUrl: finalImageUrl || undefined,
                prepTime,
                cookTime,
                servings,
                difficulty: difficulty as any,
                ingredients: validIngredients,
                steps: validSteps,
            });

            if (result.error) {
                setError(result.error);
            } else {
                // Success! Redirect to recipe page
                router.push(`/recipes/${result.recipeId}`);
                router.refresh();
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto p-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Share Your Recipe</h1>
                    <p className="text-muted-foreground">
                        Help fellow home cooks by sharing your favorite dishes
                    </p>
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {uploadError && (
                    <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 dark:bg-yellow-950/20 dark:border-yellow-700 dark:text-yellow-300 px-4 py-3 rounded text-sm flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{uploadError}</span>
                    </div>
                )}

                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium mb-2">
                            Recipe Title *
                        </label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Grandma's Sunday Pasta"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium mb-2">
                            Description *
                        </label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Tell us about this recipe..."
                            rows={4}
                            required
                        />
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Recipe Photo
                        </label>
                        {imageUrl ? (
                            <div className="relative">
                                <img
                                    src={imageUrl}
                                    alt="Recipe preview"
                                    className="w-full h-64 object-cover rounded-lg"
                                />
                                {uploadProgress === 'uploading' && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                                        <div className="text-white text-center">
                                            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                                            <p className="text-sm">Uploading image...</p>
                                        </div>
                                    </div>
                                )}
                                {uploadProgress === 'done' && (
                                    <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                        ✓ Uploaded
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={() => {
                                        if (imageUrl.startsWith('blob:')) {
                                            URL.revokeObjectURL(imageUrl);
                                        }
                                        setImageUrl("");
                                        setImageFile(null);
                                        setUploadProgress('idle');
                                        setUploadError(null);
                                    }}
                                >
                                    Remove
                                </Button>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
                                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Upload a photo of your dish
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                <div className="flex gap-2 justify-center">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Choose Photo
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recipe Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="prepTime" className="block text-sm font-medium mb-2">
                            <Clock className="inline w-4 h-4 mr-1" />
                            Prep Time (min)
                        </label>
                        <Input
                            id="prepTime"
                            type="number"
                            value={prepTime || ""}
                            onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="30"
                        />
                    </div>

                    <div>
                        <label htmlFor="cookTime" className="block text-sm font-medium mb-2">
                            <Clock className="inline w-4 h-4 mr-1" />
                            Cook Time (min)
                        </label>
                        <Input
                            id="cookTime"
                            type="number"
                            value={cookTime || ""}
                            onChange={(e) => setCookTime(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="45"
                        />
                    </div>

                    <div>
                        <label htmlFor="servings" className="block text-sm font-medium mb-2">
                            <Users className="inline w-4 h-4 mr-1" />
                            Servings
                        </label>
                        <Input
                            id="servings"
                            type="number"
                            value={servings}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setServings(Number.isNaN(val) || val < 1 ? 1 : val);
                            }}
                            min={1}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="difficulty" className="block text-sm font-medium mb-2">
                            <ChefHat className="inline w-4 h-4 mr-1" />
                            Difficulty
                        </label>
                        <select
                            id="difficulty"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                        >
                            {DIFFICULTY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Ingredients */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Ingredients *</h2>
                        <div className="flex gap-2">
                            <Button type="button" onClick={() => setShowCamera(true)} variant="outline" size="sm">
                                <Camera className="w-4 h-4 mr-2" />
                                Scan Ingredients
                            </Button>
                            <Button type="button" onClick={addIngredient} variant="outline" size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Ingredient
                            </Button>
                        </div>
                    </div>

                    {ingredients.map((ing, index) => (
                        <div key={index} className="flex gap-2 items-start">
                            <Input
                                placeholder="e.g., Tomatoes"
                                value={ing.name}
                                onChange={(e) => updateIngredient(index, "name", e.target.value)}
                                className="flex-1"
                            />
                            <Input
                                placeholder="e.g., 2 cups"
                                value={ing.amount}
                                onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                                className="flex-1"
                            />
                            <label className="flex items-center gap-2 px-3 py-2 border rounded-md">
                                <input
                                    type="checkbox"
                                    checked={ing.isOptional}
                                    onChange={(e) => updateIngredient(index, "isOptional", e.target.checked)}
                                />
                                <span className="text-sm">Optional</span>
                            </label>
                            {ingredients.length > 1 && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => removeIngredient(index)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    ))}

                    {(isFetchingSuggestions || suggestionError || suggestedRecipes.length > 0) && (
                        <Card className="p-4 gap-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="font-semibold text-sm">Suggested Recipes from Scanned Ingredients</h3>
                                {isFetchingSuggestions && (
                                    <span className="text-xs text-muted-foreground">Finding matches...</span>
                                )}
                            </div>

                            {suggestionError && (
                                <p className="text-sm text-amber-700">{suggestionError}</p>
                            )}

                            {!isFetchingSuggestions && !suggestionError && suggestedRecipes.length === 0 && (
                                <p className="text-sm text-muted-foreground">No matching recipes found yet. Try scanning more ingredients.</p>
                            )}

                            <div className="space-y-2">
                                {suggestedRecipes.map((item) => (
                                    <div key={item.recipe.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">{item.recipe.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {item.reason || "Matched from scanned ingredients"}
                                            </p>
                                            {typeof item.matchPercent === "number" && (
                                                <p className="text-xs text-green-700 mt-1">{item.matchPercent}% match</p>
                                            )}
                                        </div>
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={`/recipes/${item.recipe.id}`}>View</Link>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>

                {/* Steps */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Cooking Steps *</h2>
                        <Button type="button" onClick={addStep} variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Step
                        </Button>
                    </div>

                    {steps.map((step, index) => (
                        <div key={index} className="space-y-2 p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm">Step {index + 1}</span>
                                {steps.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeStep(index)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                            <Textarea
                                placeholder="Describe this step in detail..."
                                value={step.content}
                                onChange={(e) => updateStep(index, "content", e.target.value)}
                                rows={3}
                            />
                        </div>
                    ))}
                </div>

                {/* Submit */}
                <div className="flex gap-4">
                    <Button
                        type="submit"
                        disabled={isSubmitting || uploadProgress === 'uploading'}
                        className="flex-1"
                        size="lg"
                    >
                        {uploadProgress === 'uploading' ? "Uploading image..." : isSubmitting ? "Creating Recipe..." : "Publish Recipe"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                </div>
            </form>

            {/* Camera Scanner Overlay (lazy-loaded) */}
            {showCamera && (
                <Suspense fallback={
                    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                        <div className="text-white text-center">
                            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
                            <p>Loading camera scanner...</p>
                        </div>
                    </div>
                }>
                    <CameraScanner
                        onIngredientsDetected={(detected) => {
                            const existingNames = ingredients
                                .map((item) => item.name.trim().toLowerCase())
                                .filter(Boolean);
                            const detectedNames = detected
                                .map((item) => item.name.trim().toLowerCase())
                                .filter(Boolean);

                            const mergedForSuggestions = Array.from(new Set([...existingNames, ...detectedNames]));

                            setIngredients((prev) => {
                                const next = [...prev];
                                const existing = new Set(
                                    next.map((item) => item.name.trim().toLowerCase()).filter(Boolean)
                                );

                                for (const scannedName of detectedNames) {
                                    if (existing.has(scannedName)) continue;

                                    const emptyIndex = next.findIndex((item) => item.name.trim() === "");
                                    const formattedName = titleCase(scannedName);

                                    if (emptyIndex >= 0) {
                                        next[emptyIndex] = {
                                            ...next[emptyIndex],
                                            name: formattedName,
                                        };
                                    } else {
                                        next.push({
                                            name: formattedName,
                                            amount: "",
                                            isOptional: false,
                                        });
                                    }

                                    existing.add(scannedName);
                                }

                                return next;
                            });

                            fetchSuggestionsFromDetected(mergedForSuggestions);
                            setShowCamera(false);
                        }}
                        onClose={() => setShowCamera(false)}
                    />
                </Suspense>
            )}
        </>
    );
}
