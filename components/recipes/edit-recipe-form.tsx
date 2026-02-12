"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Difficulty } from "@/lib/generated/prisma";
import { updateRecipe } from "@/lib/actions/recipe-actions";
import { UploadButton } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Clock, Users, ChefHat, ImageIcon, Save } from "lucide-react";

interface EditRecipeFormProps {
    recipeId: string;
    initialData: {
        title: string;
        description: string;
        imageUrl: string;
        prepTime?: number;
        cookTime?: number;
        servings: number;
        difficulty: Difficulty;
        ingredients: { name: string; amount: string; isOptional: boolean }[];
        steps: { content: string; imageUrl: string }[];
    };
}

export function EditRecipeForm({ recipeId, initialData }: EditRecipeFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state - initialized with existing data
    const [title, setTitle] = useState(initialData.title);
    const [description, setDescription] = useState(initialData.description);
    const [imageUrl, setImageUrl] = useState(initialData.imageUrl);
    const [prepTime, setPrepTime] = useState<number | undefined>(initialData.prepTime);
    const [cookTime, setCookTime] = useState<number | undefined>(initialData.cookTime);
    const [servings, setServings] = useState(initialData.servings);
    const [difficulty, setDifficulty] = useState<Difficulty>(initialData.difficulty);

    const [ingredients, setIngredients] = useState(
        initialData.ingredients.length > 0
            ? initialData.ingredients
            : [{ name: "", amount: "", isOptional: false }]
    );
    const [steps, setSteps] = useState(
        initialData.steps.length > 0
            ? initialData.steps
            : [{ content: "", imageUrl: "" }]
    );

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

    // Form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const result = await updateRecipe(recipeId, {
                title,
                description,
                imageUrl: imageUrl || undefined,
                prepTime,
                cookTime,
                servings,
                difficulty,
                ingredients: ingredients.filter((ing) => ing.name && ing.amount),
                steps: steps.filter((step) => step.content),
            });

            if (result.error) {
                setError(result.error);
            } else {
                router.push(`/recipes/${recipeId}`);
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
        <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto p-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Edit Recipe</h1>
                <p className="text-muted-foreground">
                    Update your recipe details below
                </p>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                    {error}
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
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => setImageUrl("")}
                            >
                                Remove
                            </Button>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <UploadButton
                                endpoint="recipeImage"
                                onClientUploadComplete={(res) => {
                                    if (res?.[0]?.url) {
                                        setImageUrl(res[0].url);
                                    }
                                }}
                                onUploadError={(error: Error) => {
                                    setError(`Upload failed: ${error.message}`);
                                }}
                            />
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
                        onChange={(e) => setServings(Number(e.target.value))}
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
                        onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                        className="w-full px-3 py-2 border rounded-md"
                    >
                        <option value={Difficulty.EASY}>Easy</option>
                        <option value={Difficulty.MEDIUM}>Medium</option>
                        <option value={Difficulty.HARD}>Hard</option>
                    </select>
                </div>
            </div>

            {/* Ingredients */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Ingredients *</h2>
                    <Button type="button" onClick={addIngredient} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Ingredient
                    </Button>
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
                    disabled={isSubmitting}
                    className="flex-1"
                    size="lg"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {isSubmitting ? "Saving Changes..." : "Save Changes"}
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
    );
}
