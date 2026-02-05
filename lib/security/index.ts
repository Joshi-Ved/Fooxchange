/**
 * Security Module - Central Export
 * 
 * @module lib/security
 */

// Model Integrity (for AI model verification)
export {
    computeSHA256,
    verifyModel,
    verifyModelFile,
    loadModelManifest,
    loadModelSecure,
    type ModelManifest,
    type IntegrityCheckResult,
} from './model-integrity';

// Vector Validation (for semantic search security)
export {
    validateVector,
    sanitizeVector,
    validateVectorFromRequest,
    validateVectorBatch,
    EMBEDDING_DIMENSIONS,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_DIMENSIONS,
    type VectorValidationResult,
    type EmbeddingModel,
} from './vector-validation';

// Secure Storage (encrypted IndexedDB)
export {
    secureSet,
    secureGet,
    secureDelete,
    secureListKeys,
    secureClearAll,
    isSecureStorageAvailable,
    type SecureStorageOptions,
} from './secure-storage';
