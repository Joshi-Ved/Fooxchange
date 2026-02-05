/**
 * Edge AI Library
 * Client-side AI for Fooxchange V3
 * 
 * Zero-cost, privacy-first AI features:
 * - Edge Vision: Client-side ingredient detection (TensorFlow.js)
 * - Edge Search: Client-side semantic search (Transformers.js)
 */

// Vision
export { EdgeVisionService, getEdgeVisionService } from './edge-vision';
export type { DetectedIngredient, VisionAnalysisResult } from './edge-vision';
export { useEdgeVision } from './use-edge-vision';

// Search
export { EdgeSearchService, getEdgeSearchService } from './edge-search';
export type { SearchEmbedding, EdgeSearchOptions } from './edge-search';
export { useEdgeSearch } from './use-edge-search';
