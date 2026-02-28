'use client';

/**
 * PWA Update Notification
 * Notifies users when a new version is available
 */

import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/components/providers/pwa-provider';

export function PWAUpdateNotification() {
    const { serviceWorker } = usePWA();
    const [dismissed, setDismissed] = useState(false);

    if (!serviceWorker.status.updateAvailable || dismissed) {
        return null;
    }

    return (
        <Card className="fixed top-20 left-4 right-4 z-50 p-4 shadow-lg border-blue-200 bg-blue-50 md:left-auto md:right-4 md:max-w-md">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-sm text-blue-900">
                        Update Available
                    </h3>
                    <p className="text-xs text-blue-700 mt-1">
                        A new version of Fooxchange is ready to install
                    </p>
                    <div className="flex gap-2 mt-3">
                        <Button
                            size="sm"
                            onClick={serviceWorker.activateUpdate}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Update Now
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDismissed(true)}
                            className="text-blue-700"
                        >
                            Later
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
