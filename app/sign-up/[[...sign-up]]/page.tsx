import { SignUp } from "@clerk/nextjs";

export const metadata = {
    title: "Sign Up | Fooxchange",
    description: "Join Fooxchange and start sharing your culinary masterpieces with home cooks worldwide",
};

export default function SignUpPage() {
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
