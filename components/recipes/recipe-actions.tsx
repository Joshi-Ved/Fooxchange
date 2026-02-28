"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { deleteRecipe } from "@/lib/actions/recipe-actions";

interface RecipeActionsProps {
    recipeId: string;
}

export function RecipeActions({ recipeId }: RecipeActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDelete = () => {
        setError(null);
        startTransition(async () => {
            const result = await deleteRecipe(recipeId);
            if (result.error) {
                setError(result.error);
            } else {
                router.push("/recipes");
                router.refresh();
            }
        });
    };

    return (
        <div className="flex flex-col gap-2">
            {error && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => router.push(`/recipes/${recipeId}/edit`)}
                >
                    <Pencil className="h-4 w-4" />
                    Edit
                </Button>

                {!showConfirm ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => setShowConfirm(true)}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </Button>
                ) : (
                    <div className="flex gap-2 items-center">
                        <span className="text-sm text-destructive font-medium">Are you sure?</span>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDelete}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Yes, Delete"
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowConfirm(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
