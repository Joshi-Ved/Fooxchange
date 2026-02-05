'use client';

/**
 * PWA Install Banner
 * Prompts users to install the app on their device
 */

import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/components/providers/pwa-provider';

export function PWAInstallBanner() {
    const { install } = usePWA();
    const [dismissed, setDismissed] = useState(false);

    // Don't show if already installed, not installable, or user dismissed
    if (!install.isInstallable || install.isInstalled || dismissed) {
        return null;
    }

    const handleInstall = async () => {
        const result = await install.promptInstall();
        if (result.accepted) {
            console.log('User accepted the install prompt');
        } else {
            setDismissed(true);
        }
    };

    return (
        <Card className="fixed bottom-4 left-4 right-4 z-50 p-4 shadow-lg border-green-200 bg-green-50 md:left-auto md:right-4 md:max-w-md">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Download className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-sm text-green-900">
                        Install Fooxchange
                    </h3>
                    <p className="text-xs text-green-700 mt-1">
                        Install our app for a faster experience and offline access
                    </p>
                    <div className="flex gap-2 mt-3">
                        <Button
                            size="sm"
                            onClick={handleInstall}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Install
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDismissed(true)}
                            className="text-green-700"
                        >
                            Not now
                        </Button>
                    </div>
                </div>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDismissed(true)}
                    className="flex-shrink-0 -mt-1 -mr-1"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </Card>
    );
}
