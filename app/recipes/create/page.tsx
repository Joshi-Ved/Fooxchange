import { CreateRecipeForm } from "@/components/recipes/create-recipe-form";

export const metadata = {
    title: "Create Recipe | Fooxchange",
    description: "Share your favorite recipe with the Fooxchange community",
};

export default function CreateRecipePage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
            <div className="container py-10">
                <CreateRecipeForm />
            </div>
        </div>
    );
}
