"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Copy } from "lucide-react";

interface ShareButtonProps {
    title: string;
    description: string;
}

export function ShareButton({ title, description }: ShareButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const url = window.location.href;

        // Use native Web Share API if available
        if (navigator.share) {
            try {
                await navigator.share({ title, text: description, url });
                return;
            } catch (err) {
                // User cancelled or API failed — fall through to clipboard
                if ((err as DOMException)?.name === "AbortError") return;
            }
        }

        // Fallback: copy URL to clipboard
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard API not available (e.g. insecure context)
        }
    };

    return (
        <Button
            variant="outline"
            className="gap-2 rounded-full"
            onClick={handleShare}
        >
            {copied ? (
                <>
                    <Check className="h-5 w-5 text-green-500" />
                    Copied!
                </>
            ) : (
                <>
                    <Share2 className="h-5 w-5" />
                    Share
                </>
            )}
        </Button>
    );
}
