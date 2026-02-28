'use client';

/**
 * Offline Indicator
 * Shows network status to users
 */

import { WifiOff, Wifi } from 'lucide-react';
import { usePWA } from '@/components/providers/pwa-provider';

export function OfflineIndicator() {
    const { isOnline } = usePWA();

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${isOnline ? 'translate-y-full' : 'translate-y-0'
                }`}
        >
            <div className="bg-yellow-500 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
                <WifiOff className="w-4 h-4" />
                <span>You're offline. Some features may be limited.</span>
            </div>
        </div>
    );
}

export function OnlineIndicator({ showOnlineMessage = true }: { showOnlineMessage?: boolean }) {
    const { isOnline } = usePWA();

    // Only show when user has come back online
    if (!showOnlineMessage || !isOnline) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
            <div className="bg-green-500 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
                <Wifi className="w-4 h-4" />
                <span>You're back online!</span>
            </div>
        </div>
    );
}
