/**
 * Secure Storage Utility (IndexedDB with Encryption)
 * 
 * Provides encrypted local storage using IndexedDB + libsodium.
 * Used for storing sensitive user data (pantry, preferences) offline.
 * 
 * NOTE: libsodium-wrappers must be installed:
 * npm install libsodium-wrappers
 * 
 * @module lib/security/secure-storage
 */

// Type-safe wrapper around libsodium (will be dynamically imported)
type Sodium = typeof import('libsodium-wrappers');
let sodium: Sodium | null = null;

// Database configuration
const DB_NAME = 'fooxchange_secure';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted_data';

// Key derivation salt (should be unique per installation but consistent)
const SALT_KEY = '__fooxchange_salt__';

/**
 * Initialize libsodium (must be called once before using encryption)
 */
async function initSodium(): Promise<Sodium> {
    if (sodium) return sodium;

    try {
        const _sodium = await import('libsodium-wrappers');
        await _sodium.ready;
        sodium = _sodium;
        return sodium;
    } catch (error) {
        console.error('[SecureStorage] Failed to load libsodium:', error);
        throw new Error('Encryption library not available. Install libsodium-wrappers.');
    }
}

/**
 * Opens the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(new Error(`Failed to open database: ${request.error?.message}`));
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
    });
}

/**
 * Derives an encryption key from a password/session token
 * Uses Argon2id (memory-hard, resistant to GPU attacks)
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
    const _sodium = await initSodium();

    // Argon2id parameters (balanced security/performance)
    const key = _sodium.crypto_pwhash(
        _sodium.crypto_secretbox_KEYBYTES,
        password,
        salt,
        _sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        _sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        _sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    return key;
}

/**
 * Gets or creates encryption salt for this installation
 */
async function getOrCreateSalt(): Promise<Uint8Array> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const getRequest = store.get(SALT_KEY);

        getRequest.onsuccess = async () => {
            if (getRequest.result) {
                // Salt exists, return it
                resolve(new Uint8Array(getRequest.result.value));
            } else {
                // Generate new salt
                const _sodium = await initSodium();
                const newSalt = _sodium.randombytes_buf(_sodium.crypto_pwhash_SALTBYTES);

                // Store it
                const putRequest = store.put({ key: SALT_KEY, value: Array.from(newSalt) });
                putRequest.onsuccess = () => resolve(newSalt);
                putRequest.onerror = () => reject(new Error('Failed to store salt'));
            }
        };

        getRequest.onerror = () => reject(new Error('Failed to retrieve salt'));
    });
}

/**
 * Encrypts data using libsodium secretbox
 */
async function encrypt(data: string, key: Uint8Array): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array }> {
    const _sodium = await initSodium();

    const nonce = _sodium.randombytes_buf(_sodium.crypto_secretbox_NONCEBYTES);
    const message = _sodium.from_string(data);
    const ciphertext = _sodium.crypto_secretbox_easy(message, nonce, key);

    return { nonce, ciphertext };
}

/**
 * Decrypts data using libsodium secretbox
 */
async function decrypt(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Promise<string> {
    const _sodium = await initSodium();

    try {
        const decrypted = _sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
        return _sodium.to_string(decrypted);
    } catch {
        throw new Error('Decryption failed - data may be corrupted or key is wrong');
    }
}

// ============================================================
// PUBLIC API
// ============================================================

export interface SecureStorageOptions {
    /** Password or session token to derive encryption key */
    password: string;
}

/**
 * Stores encrypted data in IndexedDB
 * 
 * @example
 * await secureSet('pantry', { items: ['tomato', 'onion'] }, { password: userSessionId });
 */
export async function secureSet<T>(
    key: string,
    value: T,
    options: SecureStorageOptions
): Promise<void> {
    const salt = await getOrCreateSalt();
    const encryptionKey = await deriveKey(options.password, salt);

    const jsonData = JSON.stringify(value);
    const { nonce, ciphertext } = await encrypt(jsonData, encryptionKey);

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const record = {
            key,
            nonce: Array.from(nonce),
            ciphertext: Array.from(ciphertext),
            updatedAt: Date.now(),
        };

        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to store: ${request.error?.message}`));
    });
}

/**
 * Retrieves and decrypts data from IndexedDB
 * 
 * @example
 * const pantry = await secureGet<{ items: string[] }>('pantry', { password: userSessionId });
 */
export async function secureGet<T>(
    key: string,
    options: SecureStorageOptions
): Promise<T | null> {
    const salt = await getOrCreateSalt();
    const encryptionKey = await deriveKey(options.password, salt);

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        const request = store.get(key);

        request.onsuccess = async () => {
            if (!request.result) {
                resolve(null);
                return;
            }

            try {
                const { nonce, ciphertext } = request.result;
                const decrypted = await decrypt(
                    new Uint8Array(ciphertext),
                    new Uint8Array(nonce),
                    encryptionKey
                );
                resolve(JSON.parse(decrypted));
            } catch (error) {
                reject(error);
            }
        };

        request.onerror = () => reject(new Error(`Failed to retrieve: ${request.error?.message}`));
    });
}

/**
 * Deletes encrypted data from IndexedDB
 */
export async function secureDelete(key: string): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to delete: ${request.error?.message}`));
    });
}

/**
 * Lists all keys in secure storage (not the values)
 */
export async function secureListKeys(): Promise<string[]> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        const request = store.getAllKeys();

        request.onsuccess = () => {
            const keys = (request.result as string[]).filter(k => k !== SALT_KEY);
            resolve(keys);
        };

        request.onerror = () => reject(new Error(`Failed to list keys: ${request.error?.message}`));
    });
}

/**
 * Clears all encrypted data (but keeps the salt)
 * Use for logout/account deletion
 */
export async function secureClearAll(): Promise<void> {
    const keys = await secureListKeys();

    for (const key of keys) {
        await secureDelete(key);
    }
}

/**
 * Checks if secure storage is available in this browser
 */
export function isSecureStorageAvailable(): boolean {
    return typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined';
}
