import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChefHat, Home, Search } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
            <div className="text-center">
                {/* Large 404 Animation */}
                <div className="mb-8 text-9xl font-bold">
                    <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
                        404
                    </span>
                </div>

                {/* Icon */}
                <div className="mb-6 flex justify-center">
                    <div className="rounded-full bg-muted p-6">
                        <ChefHat className="h-16 w-16 text-muted-foreground" />
                    </div>
                </div>

                {/* Message */}
                <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
                    Page Not Found
                </h1>
                <p className="mb-8 text-lg text-muted-foreground">
                    Oops! The page you&apos;re looking for doesn&apos;t exist. 🍽️
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                    <Button asChild className="gap-2 rounded-full" size="lg">
                        <Link href="/">
                            <Home className="h-5 w-5" />
                            Go Home
                        </Link>
                    </Button>
                    <Button
                        asChild
                        variant="outline"
                        className="gap-2 rounded-full"
                        size="lg"
                    >
                        <Link href="/recipes">
                            variant="outline"
                            <Search className="h-5 w-5" />
                            Browse Recipes
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
