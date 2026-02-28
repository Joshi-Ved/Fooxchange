"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
    useEffect(() => {
        console.error("[App Error]", error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
            <div className="text-center max-w-md">
                <div className="mb-6 flex justify-center">
                    <div className="rounded-full bg-destructive/10 p-4">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                    </div>
                </div>

                <h1 className="mb-3 text-2xl font-bold">Something went wrong</h1>
                <p className="mb-6 text-muted-foreground">
                    An unexpected error occurred. Please try again or return to the home page.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button onClick={reset} className="gap-2 rounded-full">
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                    </Button>
                    <Link href="/">
                        <Button variant="outline" className="gap-2 rounded-full w-full sm:w-auto">
                            <Home className="h-4 w-4" />
                            Go Home
                        </Button>
                    </Link>
                </div>

                {error.digest && (
                    <p className="mt-6 text-xs text-muted-foreground">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
