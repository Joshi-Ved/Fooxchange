import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTrendingRecipes } from "@/lib/actions/feed-actions";
import { RecipeCard } from "@/components/recipes/recipe-card";
import {
  ChefHat,
  Search,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

// Force dynamic rendering - page queries DB for trending recipes
export const dynamic = 'force-dynamic';

const howItWorks = [
  {
    icon: Search,
    title: "Select Ingredients",
    description: "Tell us what's in your fridge",
  },
  {
    icon: Sparkles,
    title: "Discover Recipes",
    description: "Get personalized suggestions",
  },
  {
    icon: ChefHat,
    title: "Start Cooking",
    description: "Follow easy step-by-step guides",
  },
];

export default async function Home() {
  const trendingRecipes = await getTrendingRecipes(3);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-background to-rose-500/10" />
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-rose-400/15 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Community-powered recipe sharing
            </div>

            {/* Headline */}
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Never Ask{" "}
              <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
                "What to Cook?"
              </span>{" "}
              Again
            </h1>

            <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Exchange recipes with home cooks like you. Tell us what's in your
              fridge, and we'll show you delicious dishes you can make right
              now.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="gap-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-8 text-white hover:from-orange-600 hover:to-rose-600"
              >
                <Link href="/recipes">
                  size="lg"
                  <ChefHat className="h-5 w-5" />
                  Browse Recipes
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 rounded-full px-8"
              >
                <Link href="/recipes/create">
                  size="lg"
                  <Sparkles className="h-5 w-5" />
                  Share Your Recipe
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Cook smarter, not harder
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Three simple steps to discover your next favorite meal
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {howItWorks.map((step, index) => (
              <Card
                key={index}
                className="group relative border-0 bg-background/60 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg transition-transform group-hover:scale-110">
                    <step.icon className="h-8 w-8" />
                  </div>
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Recipes Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Trending today
              </h2>
              <p className="mt-2 text-muted-foreground">
                Loved by our community of home chefs
              </p>
            </div>
            <Button asChild variant="ghost" className="gap-2">
              <Link href="/recipes">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {trendingRecipes.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trendingRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          ) : (
            <div className="mt-10 text-center">
              <div className="mb-4 text-6xl">🍳</div>
              <p className="text-muted-foreground">
                No recipes yet. Be the first to share!
              </p>
              <Button asChild className="mt-4 gap-2 rounded-full">
                <Link href="/recipes/create">
                  <Sparkles className="h-5 w-5" />
                  Create First Recipe
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-gradient-to-r from-orange-500 to-rose-500 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to share your family recipes?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Join thousands of home cooks exchanging their favorite dishes
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-8 gap-2 rounded-full px-8"
          >
            <Link href="/sign-up">
              size="lg"
              <ChefHat className="h-5 w-5" />
              Join Fooxchange
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2 text-xl font-bold">
              <ChefHat className="h-6 w-6 text-orange-500" />
              <span>Fooxchange</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Fooxchange. Made with ❤️ for home cooks everywhere.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>Community recipes</span>
              <span>Ingredient search</span>
              <span>Edge AI scanner</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
