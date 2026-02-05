/**
 * Model Integrity Verification
 * 
 * Prevents tampering with AI models served from /public/models/
 * Uses SHA-256 hashes to verify model files haven't been modified.
 * 
 * @module lib/security/model-integrity
 */

// Model manifest type - stores expected hashes for all model files
export interface ModelManifest {
    version: string;
    generatedAt: string;
    models: {
        [modelName: string]: {
            files: {
                [fileName: string]: string; // filename -> SHA-256 hash
            };
            totalSize: number; // bytes
            description: string;
        };
    };
}

// Result of integrity check
export interface IntegrityCheckResult {
    valid: boolean;
    modelName: string;
    errors: string[];
    checkedFiles: number;
    timestamp: Date;
}

/**
 * Computes SHA-256 hash of an ArrayBuffer
 * Uses Web Crypto API (available in all modern browsers)
 */
export async function computeSHA256(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fetches and verifies a model file against its expected hash
 */
export async function verifyModelFile(
    fileUrl: string,
    expectedHash: string
): Promise<{ valid: boolean; actualHash: string; error?: string }> {
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            return {
                valid: false,
                actualHash: '',
                error: `Failed to fetch: ${response.status} ${response.statusText}`
            };
        }

        const arrayBuffer = await response.arrayBuffer();
        const actualHash = await computeSHA256(arrayBuffer);

        return {
            valid: actualHash === expectedHash,
            actualHash,
            error: actualHash !== expectedHash
                ? `Hash mismatch. Expected: ${expectedHash.slice(0, 16)}..., Got: ${actualHash.slice(0, 16)}...`
                : undefined
        };
    } catch (error) {
        return {
            valid: false,
            actualHash: '',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Loads and parses the model manifest from /public/models/manifest.json
 */
export async function loadModelManifest(): Promise<ModelManifest | null> {
    try {
        const response = await fetch('/models/manifest.json');
        if (!response.ok) {
            console.error('[ModelIntegrity] Manifest not found. Run build:model-hashes first.');
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('[ModelIntegrity] Failed to load manifest:', error);
        return null;
    }
}

/**
 * Verifies all files for a specific model against the manifest
 * Call this BEFORE loading a model into TensorFlow.js
 */
export async function verifyModel(modelName: string): Promise<IntegrityCheckResult> {
    const result: IntegrityCheckResult = {
        valid: true,
        modelName,
        errors: [],
        checkedFiles: 0,
        timestamp: new Date()
    };

    // Load manifest
    const manifest = await loadModelManifest();
    if (!manifest) {
        result.valid = false;
        result.errors.push('Model manifest not found');
        return result;
    }

    // Check if model exists in manifest
    const modelInfo = manifest.models[modelName];
    if (!modelInfo) {
        result.valid = false;
        result.errors.push(`Model "${modelName}" not found in manifest`);
        return result;
    }

    // Verify each file
    const fileEntries = Object.entries(modelInfo.files);
    for (const [fileName, expectedHash] of fileEntries) {
        const fileUrl = `/models/${modelName}/${fileName}`;
        const verification = await verifyModelFile(fileUrl, expectedHash);

        result.checkedFiles++;

        if (!verification.valid) {
            result.valid = false;
            result.errors.push(`${fileName}: ${verification.error}`);
        }
    }

    // Log result
    if (result.valid) {
        console.log(`[ModelIntegrity] ✓ Model "${modelName}" verified (${result.checkedFiles} files)`);
    } else {
        console.error(`[ModelIntegrity] ✗ Model "${modelName}" FAILED verification:`, result.errors);
    }

    return result;
}

/**
 * Security: Refuse to load model if integrity check fails
 * Wrapper for use with TensorFlow.js model loading
 */
export async function loadModelSecure<T>(
    modelName: string,
    loadFn: () => Promise<T>
): Promise<T> {
    const integrityResult = await verifyModel(modelName);

    if (!integrityResult.valid) {
        const errorMsg = `Model integrity check failed for "${modelName}". ` +
            `This could indicate tampering. Errors: ${integrityResult.errors.join(', ')}`;

        // Log security incident (in production, send to monitoring)
        console.error('[SECURITY] Model tampering detected:', {
            modelName,
            errors: integrityResult.errors,
            timestamp: integrityResult.timestamp.toISOString()
        });

        throw new Error(errorMsg);
    }

    // Model is verified, safe to load
    return loadFn();
}
