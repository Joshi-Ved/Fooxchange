'use client';

/**
 * Service Worker Registration and Update Management
 * Handles PWA installation, updates, and user notifications
 */

import { useEffect, useState } from 'react';

export interface ServiceWorkerStatus {
    registered: boolean;
    updateAvailable: boolean;
    installing: boolean;
    error: string | null;
}

export function useServiceWorker() {
    const [status, setStatus] = useState<ServiceWorkerStatus>({
        registered: false,
        updateAvailable: false,
        installing: false,
        error: null,
    });

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            setStatus(prev => ({
                ...prev,
                error: 'Service Workers not supported in this browser'
            }));
            return;
        }

        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
        if (process.env.NODE_ENV !== 'production' || isLocalhost) {
            // Avoid stale SW behavior while developing locally.
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => {
                    void registration.unregister();
                });
            });
            return;
        }

        registerServiceWorker();
    }, []);

    const registerServiceWorker = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
            });

            console.log('[PWA] Service Worker registered:', registration);

            setStatus(prev => ({ ...prev, registered: true, error: null }));

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;

                console.log('[PWA] New Service Worker installing...');
                setStatus(prev => ({ ...prev, installing: true }));

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // New update available
                            console.log('[PWA] Update available!');
                            setStatus(prev => ({
                                ...prev,
                                updateAvailable: true,
                                installing: false,
                            }));
                        } else {
                            // First install
                            console.log('[PWA] Service Worker installed (first time)');
                            setStatus(prev => ({ ...prev, installing: false }));
                        }
                    }
                });
            });

            // Auto-check for updates every hour
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000);
        } catch (error) {
            console.error('[PWA] Service Worker registration failed:', error);
            setStatus(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Registration failed',
            }));
        }
    };

    const activateUpdate = async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration || !registration.waiting) return;

        // Tell the waiting SW to skipWaiting and activate
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });

        // Reload once the new SW is activated
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    };

    return { status, activateUpdate };
}

/**
 * Install Prompt Hook
 * Handles PWA "Add to Home Screen" prompt
 */
export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the default browser prompt
            e.preventDefault();

            // Store the event for later use
            setDeferredPrompt(e);
            setIsInstallable(true);

            console.log('[PWA] Install prompt available');
        };

        const handleAppInstalled = () => {
            console.log('[PWA] App installed successfully');
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const promptInstall = async () => {
        if (!deferredPrompt) {
            console.warn('[PWA] No install prompt available');
            return { accepted: false };
        }

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user's response
        const { outcome } = await deferredPrompt.userChoice;

        console.log('[PWA] Install prompt result:', outcome);

        // Clear the prompt
        setDeferredPrompt(null);
        setIsInstallable(false);

        return { accepted: outcome === 'accepted' };
    };

    return { isInstallable, isInstalled, promptInstall };
}

/**
 * Network Status Hook
 * Monitors online/offline status for PWA
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const handleOnline = () => {
            console.log('[PWA] Back online');
            setIsOnline(true);
        };

        const handleOffline = () => {
            console.log('[PWA] Gone offline');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}
