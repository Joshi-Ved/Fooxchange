/**
 * Vector Validation Utility
 * 
 * Prevents vector injection attacks on semantic search endpoints.
 * Validates that incoming embedding vectors from clients are:
 * 1. Correct dimensionality (384 for MiniLM)
 * 2. Within valid range (-1.0 to 1.0)
 * 3. Not malformed or suspicious
 * 
 * @module lib/security/vector-validation
 */

// Supported embedding models and their dimensions
export const EMBEDDING_DIMENSIONS = {
    'all-MiniLM-L6-v2': 384,
    'all-mpnet-base-v2': 768,
    'paraphrase-MiniLM-L6-v2': 384,
} as const;

export type EmbeddingModel = keyof typeof EMBEDDING_DIMENSIONS;

// Default model used in Fooxchange
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModel = 'all-MiniLM-L6-v2';
export const DEFAULT_DIMENSIONS = EMBEDDING_DIMENSIONS[DEFAULT_EMBEDDING_MODEL];

// Validation result type
export interface VectorValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    stats?: {
        dimensions: number;
        min: number;
        max: number;
        mean: number;
        norm: number;
    };
}

/**
 * Validates a vector embedding for security and correctness
 */
export function validateVector(
    vector: unknown,
    options: {
        expectedDimensions?: number;
        strictRange?: boolean; // If true, reject vectors outside [-1, 1]
    } = {}
): VectorValidationResult {
    const {
        expectedDimensions = DEFAULT_DIMENSIONS,
        strictRange = true,
    } = options;

    const result: VectorValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
    };

    // Check 1: Is it an array?
    if (!Array.isArray(vector)) {
        result.valid = false;
        result.errors.push('Vector must be an array');
        return result;
    }

    // Check 2: Is it the correct length?
    if (vector.length !== expectedDimensions) {
        result.valid = false;
        result.errors.push(
            `Invalid dimensions: expected ${expectedDimensions}, got ${vector.length}`
        );
        return result;
    }

    // Check 3: Are all elements numbers?
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < vector.length; i++) {
        const val = vector[i];

        if (typeof val !== 'number') {
            result.valid = false;
            result.errors.push(`Element at index ${i} is not a number: ${typeof val}`);
            return result;
        }

        if (!Number.isFinite(val)) {
            result.valid = false;
            result.errors.push(`Element at index ${i} is not finite: ${val}`);
            return result;
        }

        // Track stats
        min = Math.min(min, val);
        max = Math.max(max, val);
        sum += val;
        sumSquares += val * val;
    }

    // Check 4: Strict range validation [-1.0, 1.0]
    if (strictRange) {
        if (min < -1.0 || max > 1.0) {
            result.valid = false;
            result.errors.push(
                `Values out of valid range: min=${min.toFixed(4)}, max=${max.toFixed(4)}. ` +
                `Expected strict range [-1.0, 1.0]`
            );
        }
    }

    // Check 5: Anomaly detection - vectors should have reasonable norms
    const norm = Math.sqrt(sumSquares);
    const mean = sum / vector.length;

    // Normalized vectors typically have norm close to 1.0
    // Very small or very large norms are suspicious
    if (norm < 0.1) {
        result.warnings.push(`Suspiciously small norm: ${norm.toFixed(4)}. Vector may be near-zero.`);
    }
    if (norm > 50) {
        result.warnings.push(`Suspiciously large norm: ${norm.toFixed(4)}. Vector may be malformed.`);
    }

    // All zeros is definitely suspicious
    if (min === 0 && max === 0) {
        result.valid = false;
        result.errors.push('Vector is all zeros - likely malformed');
    }

    // Add stats to result
    result.stats = {
        dimensions: vector.length,
        min,
        max,
        mean,
        norm,
    };

    return result;
}

/**
 * Sanitizes a vector by clamping values to valid range
 * Use with caution - only for trusted sources where slight numerical errors may occur
 */
export function sanitizeVector(
    vector: number[],
    options: {
        clampMin?: number;
        clampMax?: number;
        normalize?: boolean;
    } = {}
): number[] {
    const {
        clampMin = -1.0,
        clampMax = 1.0,
        normalize = false,
    } = options;

    let sanitized = vector.map(v => Math.max(clampMin, Math.min(clampMax, v)));

    if (normalize) {
        const norm = Math.sqrt(sanitized.reduce((sum, v) => sum + v * v, 0));
        if (norm > 0) {
            sanitized = sanitized.map(v => v / norm);
        }
    }

    return sanitized;
}

/**
 * Express/Next.js middleware helper to validate vector in request body
 * Returns validated vector or throws error
 */
export function validateVectorFromRequest(
    body: { vector?: unknown },
    fieldName: string = 'vector'
): number[] {
    const vector = body[fieldName as keyof typeof body];

    if (vector === undefined) {
        throw new Error(`Missing required field: ${fieldName}`);
    }

    const validation = validateVector(vector);

    if (!validation.valid) {
        throw new Error(`Invalid vector: ${validation.errors.join(', ')}`);
    }

    // Log warnings but continue
    if (validation.warnings.length > 0) {
        console.warn(`[VectorValidation] Warnings for ${fieldName}:`, validation.warnings);
    }

    return vector as number[];
}

/**
 * Batch validate multiple vectors (for bulk operations)
 */
export function validateVectorBatch(
    vectors: unknown[],
    options?: Parameters<typeof validateVector>[1]
): { valid: boolean; results: VectorValidationResult[]; validCount: number } {
    const results = vectors.map(v => validateVector(v, options));
    const validCount = results.filter(r => r.valid).length;

    return {
        valid: validCount === vectors.length,
        results,
        validCount,
    };
}
