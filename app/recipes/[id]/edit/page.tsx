import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getRecipeForEdit } from "@/lib/actions/recipe-actions";
import { EditRecipeForm } from "@/components/recipes/edit-recipe-form";

interface EditRecipePageProps {
    params: Promise<{
        id: string;
    }>;
}

export const metadata = {
    title: "Edit Recipe | Fooxchange",
    description: "Edit your recipe on Fooxchange",
};

export default async function EditRecipePage({ params }: EditRecipePageProps) {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const result = await getRecipeForEdit(id);

    if (result.error || !result.recipe) {
        redirect("/recipes");
    }

    const recipe = result.recipe;

    // Transform recipe data for the form
    const initialData = {
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl || "",
        prepTime: recipe.prepTime || undefined,
        cookTime: recipe.cookTime || undefined,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        ingredients: recipe.ingredients.map((ri) => ({
            name: ri.ingredient.name,
            amount: ri.amount,
            isOptional: ri.isOptional,
        })),
        steps: recipe.steps.map((step) => ({
            content: step.content,
            imageUrl: step.imageUrl || "",
        })),
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
            <div className="container py-10">
                <EditRecipeForm recipeId={id} initialData={initialData} />
            </div>
        </div>
    );
}
