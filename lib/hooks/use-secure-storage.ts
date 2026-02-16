/**
 * useSecureStorage — React hook for encrypted IndexedDB storage
 *
 * Wraps lib/security/secure-storage.ts with React state management.
 * Uses libsodium Argon2id key derivation + XChaCha20-Poly1305 encryption.
 *
 * Use for storing sensitive offline data:
 * - User pantry items
 * - Cached scan results
 * - Offline recipe drafts
 * - User preferences
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    secureSet,
    secureGet,
    secureDelete,
    secureListKeys,
    secureClearAll
} from '@/lib/security/secure-storage';

interface UseSecureStorageOptions {
    /**
     * Passphrase for key derivation.
     * In production, derive from the user's session or a device-bound secret.
     * Defaults to a device fingerprint-based passphrase.
     */
    passphrase?: string;
}

interface UseSecureStorageReturn<T> {
    /** Currently loaded data (null before first load) */
    data: T | null;
    /** Whether a storage operation is in progress */
    isLoading: boolean;
    /** Last error message */
    error: string | null;
    /** Save data to encrypted storage */
    save: (key: string, value: T) => Promise<void>;
    /** Load data from encrypted storage */
    load: (key: string) => Promise<T | null>;
    /** Delete a key from encrypted storage */
    remove: (key: string) => Promise<void>;
    /** List all stored keys */
    listKeys: () => Promise<string[]>;
    /** Clear all encrypted data */
    clearAll: () => Promise<void>;
}

/**
 * Generate a device-bound passphrase from available browser entropy.
 * This is NOT cryptographically strong on its own — it's a fallback
 * when no user-provided passphrase is available.
 */
function getDevicePassphrase(): string {
    const parts = [
        navigator.userAgent,
        navigator.language,
        screen.width.toString(),
        screen.height.toString(),
        screen.colorDepth.toString(),
        new Date().getTimezoneOffset().toString(),
    ];
    return `fooxchange-device-${parts.join('-')}`;
}

export function useSecureStorage<T = unknown>(
    options: UseSecureStorageOptions = {}
): UseSecureStorageReturn<T> {
    const { passphrase } = options;

    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const getPassphrase = useCallback(() => {
        return passphrase || getDevicePassphrase();
    }, [passphrase]);

    const save = useCallback(async (key: string, value: T): Promise<void> => {
        if (isMountedRef.current) {
            setIsLoading(true);
            setError(null);
        }

        try {
            await secureSet(key, value, { password: getPassphrase() });

            if (isMountedRef.current) {
                setData(value);
                setIsLoading(false);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save securely';
            console.error('[SecureStorage] Save failed:', message);
            if (isMountedRef.current) {
                setError(message);
                setIsLoading(false);
            }
        }
    }, [getPassphrase]);

    const load = useCallback(async (key: string): Promise<T | null> => {
        if (isMountedRef.current) {
            setIsLoading(true);
            setError(null);
        }

        try {
            const result = await secureGet<T>(key, { password: getPassphrase() });

            if (isMountedRef.current) {
                setData(result);
                setIsLoading(false);
            }

            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load securely';
            console.error('[SecureStorage] Load failed:', message);
            if (isMountedRef.current) {
                setError(message);
                setIsLoading(false);
            }
            return null;
        }
    }, [getPassphrase]);

    const remove = useCallback(async (key: string): Promise<void> => {
        if (isMountedRef.current) {
            setIsLoading(true);
            setError(null);
        }

        try {
            await secureDelete(key);

            if (isMountedRef.current) {
                setData(null);
                setIsLoading(false);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete securely';
            console.error('[SecureStorage] Delete failed:', message);
            if (isMountedRef.current) {
                setError(message);
                setIsLoading(false);
            }
        }
    }, []);

    const listKeysWrapper = useCallback(async (): Promise<string[]> => {
        try {
            return await secureListKeys();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to list keys';
            console.error('[SecureStorage] List keys failed:', message);
            if (isMountedRef.current) {
                setError(message);
            }
            return [];
        }
    }, []);

    const clearAllWrapper = useCallback(async (): Promise<void> => {
        if (isMountedRef.current) {
            setIsLoading(true);
            setError(null);
        }

        try {
            await secureClearAll();

            if (isMountedRef.current) {
                setData(null);
                setIsLoading(false);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to clear storage';
            console.error('[SecureStorage] Clear all failed:', message);
            if (isMountedRef.current) {
                setError(message);
                setIsLoading(false);
            }
        }
    }, []);

    return {
        data,
        isLoading,
        error,
        save,
        load,
        remove,
        listKeys: listKeysWrapper,
        clearAll: clearAllWrapper,
    };
}
