'use client';

/**
 * PWA Update Notification
 * Notifies users when a new version is available
 */

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/components/providers/pwa-provider';

export function PWAUpdateNotification() {
    const { serviceWorker } = usePWA();

    if (!serviceWorker.status.updateAvailable) {
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
                    <Button
                        size="sm"
                        onClick={serviceWorker.activateUpdate}
                        className="mt-3 bg-blue-600 hover:bg-blue-700"
                    >
                        Update Now
                    </Button>
                </div>
            </div>
        </Card>
    );
}
