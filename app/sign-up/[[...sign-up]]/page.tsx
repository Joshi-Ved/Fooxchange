import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
    title: "Sign Up | Fooxchange",
    description: "Join Fooxchange and start sharing your culinary masterpieces with home cooks worldwide",
};

export default function SignUpPage() {
    const authEnabled = Boolean(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
    );

    if (!authEnabled) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-4">
                <div className="w-full max-w-md rounded-2xl border bg-background/95 p-8 text-center shadow-xl backdrop-blur">
                    <h1 className="text-3xl font-bold">Sign up unavailable</h1>
                    <p className="mt-3 text-muted-foreground">
                        Clerk is not fully configured in this environment yet.
                    </p>
                    <Button asChild className="mt-6 rounded-full">
                        <Link href="/">Go Home</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">Join Fooxchange</h1>
                    <p className="text-muted-foreground">
                        Start sharing your culinary masterpieces today
                    </p>
                </div>
                <SignUp
                    path="/sign-up"
                    routing="path"
                    signInUrl="/sign-in"
                    fallbackRedirectUrl="/"
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "shadow-xl",
                        },
                    }}
                />
            </div>
        </div>
    );
}
