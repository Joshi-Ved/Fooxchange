"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ChefHat, Plus, Search } from "lucide-react";

interface NavbarProps {
    authEnabled: boolean;
}

export function Navbar({ authEnabled }: NavbarProps) {
    const pathname = usePathname();

    const isActive = (path: string) => {
        return pathname === path;
    };

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95">
            <div className="container flex h-16 items-center justify-between px-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <ChefHat className="h-6 w-6 text-orange-500" />
                    <span className="text-xl font-bold">Fooxchange</span>
                </Link>

                {/* Navigation Links */}
                <div className="hidden md:flex items-center gap-6">
                    <Link
                        href="/recipes"
                        className={`text-sm font-medium transition-colors hover:text-orange-500 ${isActive("/recipes") ? "text-orange-500" : "text-muted-foreground"
                            }`}
                    >
                        <Search className="inline h-4 w-4 mr-1" />
                        Browse Recipes
                    </Link>
                    <Link
                        href="/recipes/create"
                        className={`text-sm font-medium transition-colors hover:text-orange-500 ${isActive("/recipes/create") ? "text-orange-500" : "text-muted-foreground"
                            }`}
                    >
                        <Plus className="inline h-4 w-4 mr-1" />
                        Share Recipe
                    </Link>
                </div>

                {/* Auth Buttons */}
                <div className="flex items-center gap-3">
                    {!authEnabled ? (
                        /* When auth is not configured, don't show auth links (MED-28) */
                        <span className="text-xs text-muted-foreground">Auth not configured</span>
                    ) : (
                        <>
                            <SignedOut>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href="/sign-in" prefetch={false}>
                                        Sign In
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="sm"
                                    className="bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600"
                                >
                                    <Link href="/sign-up" prefetch={false}>
                                        Sign Up
                                    </Link>
                                </Button>
                            </SignedOut>

                            <SignedIn>
                                <Button
                                    asChild
                                    size="sm"
                                    variant="default"
                                    className="hidden gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600 md:inline-flex"
                                >
                                    <Link href="/recipes/create">
                                        <Plus className="h-4 w-4" />
                                        Create Recipe
                                    </Link>
                                </Button>
                                <UserButton
                                    appearance={{
                                        elements: {
                                            avatarBox: "h-9 w-9"
                                        }
                                    }}
                                />
                            </SignedIn>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden border-t bg-background/95">
                <div className="container flex items-center justify-around py-2 px-4">
                    <Link
                        href="/recipes"
                        className={`flex flex-col items-center gap-1 text-xs rounded-md px-4 py-2 active:scale-95 transition-transform ${isActive("/recipes") ? "text-orange-500" : "text-muted-foreground"
                            }`}
                    >
                        <Search className="h-5 w-5" />
                        <span>Browse</span>
                    </Link>
                    <Link
                        href="/recipes/create"
                        className={`flex flex-col items-center gap-1 text-xs rounded-md px-4 py-2 active:scale-95 transition-transform ${isActive("/recipes/create") ? "text-orange-500" : "text-muted-foreground"
                            }`}
                    >
                        <Plus className="h-5 w-5" />
                        <span>Create</span>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
