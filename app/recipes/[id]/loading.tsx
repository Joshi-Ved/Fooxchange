import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-background">
            {/* Hero Skeleton */}
            <Skeleton className="h-[400px] w-full" />

            {/* Content */}
            <div className="mx-auto max-w-5xl px-4 -mt-20 relative z-10 pb-12">
                {/* Recipe Header Card Skeleton */}
                <Card className="mb-8 shadow-xl">
                    <CardContent className="p-8">
                        <div className="flex flex-col gap-6">
                            <div>
                                <Skeleton className="h-10 w-3/4 mb-3" />
                                <Skeleton className="h-6 w-full" />
                                <Skeleton className="h-6 w-2/3" />

                                {/* Author Skeleton */}
                                <div className="mt-6 flex items-center gap-3">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div>
                                        <Skeleton className="h-5 w-32 mb-2" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Meta Info Skeleton */}
                        <div className="mt-8 flex flex-wrap gap-4 border-t pt-6">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div>
                                        <Skeleton className="h-4 w-16 mb-1" />
                                        <Skeleton className="h-3 w-12" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-8 md:grid-cols-3">
                    {/* Ingredients Skeleton */}
                    <Card className="md:col-span-1">
                        <CardContent className="p-6">
                            <Skeleton className="h-8 w-32 mb-4" />
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Skeleton key={i} className="h-5 w-full" />
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Steps Skeleton */}
                    <div className="md:col-span-2 space-y-6">
                        <Skeleton className="h-8 w-40" />
                        {[1, 2, 3].map((i) => (
                            <Card key={i}>
                                <CardContent className="p-6">
                                    <div className="flex gap-4">
                                        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-5/6" />
                                            <Skeleton className="h-4 w-4/6" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
