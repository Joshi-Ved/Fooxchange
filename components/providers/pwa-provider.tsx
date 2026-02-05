'use client';

/**
 * PWA Provider Component
 * Wraps the app with PWA functionality including:
 * - Service Worker registration
 * - Install prompt management
 * - Update notifications
 * - Offline status indicator
 */

import { createContext, useContext, ReactNode } from 'react';
import { useServiceWorker, useInstallPrompt, useNetworkStatus } from '@/lib/pwa/service-worker-manager';

interface PWAContextValue {
    serviceWorker: ReturnType<typeof useServiceWorker>;
    install: ReturnType<typeof useInstallPrompt>;
    isOnline: boolean;
}

const PWAContext = createContext<PWAContextValue | null>(null);

export function usePWA() {
    const context = useContext(PWAContext);
    if (!context) {
        throw new Error('usePWA must be used within PWAProvider');
    }
    return context;
}

export function PWAProvider({ children }: { children: ReactNode }) {
    const serviceWorker = useServiceWorker();
    const install = useInstallPrompt();
    const isOnline = useNetworkStatus();

    return (
        <PWAContext.Provider value={{ serviceWorker, install, isOnline }}>
            {children}
        </PWAContext.Provider>
    );
}
