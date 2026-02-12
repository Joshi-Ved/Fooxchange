"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toggleSaveRecipe } from "@/lib/actions/recipe-actions";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface SaveRecipeButtonProps {
    recipeId: string;
    initialSaved: boolean;
    initialCount: number;
}

export function SaveRecipeButton({
    recipeId,
    initialSaved,
    initialCount,
}: SaveRecipeButtonProps) {
    const [isSaved, setIsSaved] = useState(initialSaved);
    const [count, setCount] = useState(initialCount);
    const [isPending, startTransition] = useTransition();
    const { userId } = useAuth();
    const router = useRouter();

    const handleToggleSave = () => {
        if (!userId) {
            router.push("/sign-in");
            return;
        }

        startTransition(async () => {
            try {
                const result = await toggleSaveRecipe(recipeId);
                if (result.error) {
                    console.error("Save error:", result.error);
                    return;
                }
                if (result.saved !== undefined) {
                    setIsSaved(result.saved);
                    setCount((prev) => (result.saved ? prev + 1 : prev - 1));
                }
            } catch (error) {
                console.error("Failed to save recipe:", error);
            }
        });
    };

    return (
        <Button
            variant="outline"
            className="gap-2 rounded-full"
            onClick={handleToggleSave}
            disabled={isPending}
        >
            <Heart
                className={`h-5 w-5 ${isSaved ? "fill-rose-500 text-rose-500" : ""}`}
            />
            {isSaved ? "Saved" : "Save"} ({count})
        </Button>
    );
}
