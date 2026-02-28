"use client";

import { useState, lazy, Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Camera } from "lucide-react";

// Lazy-load heavy CameraScanner component (MED-25)
const CameraScanner = lazy(() =>
    import("@/components/camera-scanner").then((m) => ({ default: m.CameraScanner }))
);

interface IngredientSearchProps {
    onSearch: (ingredients: string[]) => void;
}

export function IngredientSearch({ onSearch }: IngredientSearchProps) {
    const [inputValue, setInputValue] = useState("");
    const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
    const [showScanner, setShowScanner] = useState(false);

    const handleAddIngredient = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !selectedIngredients.includes(trimmed.toLowerCase())) {
            const newIngredients = [
                ...selectedIngredients,
                trimmed.toLowerCase(),
            ];
            setSelectedIngredients(newIngredients);
            setInputValue("");
            onSearch(newIngredients);
        }
    };

    const handleRemoveIngredient = (ingredient: string) => {
        const newIngredients = selectedIngredients.filter((i) => i !== ingredient);
        setSelectedIngredients(newIngredients);
        onSearch(newIngredients);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddIngredient();
        }
    };

    const popularIngredients = [
        "Tomatoes",
        "Onions",
        "Garlic",
        "Chicken",
        "Rice",
        "Potatoes",
        "Paneer",
        "Spinach",
    ];

    const handlePopularClick = (ingredient: string) => {
        const lower = ingredient.toLowerCase();
        if (!selectedIngredients.includes(lower)) {
            const newIngredients = [...selectedIngredients, lower];
            setSelectedIngredients(newIngredients);
            onSearch(newIngredients);
        }
    };

    const handleScannerDetected = (detected: Array<{ name: string }>) => {
        const detectedNames = detected
            .map((item) => item.name.toLowerCase().trim())
            .filter(Boolean);

        const merged = Array.from(new Set([...selectedIngredients, ...detectedNames]));
        setSelectedIngredients(merged);
        onSearch(merged);
        setShowScanner(false);
    };

    return (
        <>
            <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Type an ingredient and press Enter..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-10"
                    />
                </div>
                <Button onClick={handleAddIngredient} disabled={!inputValue.trim()}>
                    Add
                </Button>
                <Button variant="secondary" onClick={() => setShowScanner(true)}>
                    <Camera className="mr-2 h-4 w-4" />
                    Scan Ingredients (Edge AI)
                </Button>
            </div>

            {/* Selected Ingredients */}
            {selectedIngredients.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedIngredients.map((ingredient) => (
                        <Badge
                            key={ingredient}
                            variant="secondary"
                            className="gap-1 pr-1 text-sm"
                        >
                            {ingredient}
                            <button
                                onClick={() => handleRemoveIngredient(ingredient)}
                                className="ml-1 rounded-full p-0.5 hover:bg-background"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSelectedIngredients([]);
                            onSearch([]);
                        }}
                        className="h-6 text-xs"
                    >
                        Clear all
                    </Button>
                </div>
            )}

            {/* Popular Ingredients */}
            {selectedIngredients.length === 0 && (
                <div>
                    <p className="mb-2 text-sm text-muted-foreground">
                        Popular ingredients:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {popularIngredients.map((ingredient) => (
                            <Badge
                                key={ingredient}
                                variant="outline"
                                className="cursor-pointer hover:bg-muted"
                                onClick={() => handlePopularClick(ingredient)}
                            >
                                {ingredient}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
            </div>

            {showScanner && (
                <Suspense fallback={
                    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                        <div className="text-white text-center">
                            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
                            <p>Loading camera scanner...</p>
                        </div>
                    </div>
                }>
                    <CameraScanner
                        onIngredientsDetected={handleScannerDetected}
                        onClose={() => setShowScanner(false)}
                    />
                </Suspense>
            )}
        </>
    );
}
