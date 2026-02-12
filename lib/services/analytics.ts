/**
 * Analytics & Monitoring Service
 * 
 * Tracks application metrics, AI performance, and user behavior
 * Integrates with monitoring services (Vercel Analytics, Sentry, etc.)
 */

import { db } from '@/lib/db';

export interface AIMetric {
    endpoint: string;
    userId: string;
    latency: number;
    success: boolean;
    error?: string;
    metadata?: Record<string, any>;
}

export interface UserEvent {
    event: string;
    userId: string;
    properties?: Record<string, any>;
    timestamp: Date;
}

/**
 * Track AI API usage and performance
 */
export async function trackAIMetric(metric: AIMetric): Promise<void> {
    try {
        // Log to database for analytics
        // In production, send to analytics service

        console.log('[AI_METRIC]', {
            ...metric,
            timestamp: new Date().toISOString(),
        });

        // Optional: Store in database for analysis
        // await db.aiMetric.create({ data: metric });

        // Optional: Send to external service (Mixpanel, Amplitude, etc.)
        // await sendToAnalyticsService(metric);
    } catch (error) {
        console.error('Failed to track AI metric:', error);
    }
}

/**
 * Track user events
 */
export async function trackEvent(event: UserEvent): Promise<void> {
    try {
        console.log('[USER_EVENT]', {
            ...event,
            timestamp: event.timestamp.toISOString(),
        });

        // Send to analytics service
        // await analytics.track(event);
    } catch (error) {
        console.error('Failed to track event:', error);
    }
}

/**
 * Track vision API accuracy
 */
export async function trackVisionAccuracy(data: {
    userId: string;
    detectedIngredients: string[];
    confirmedIngredients: string[];
}): Promise<void> {
    const accuracy = calculateAccuracy(
        data.detectedIngredients,
        data.confirmedIngredients
    );

    await trackAIMetric({
        endpoint: 'vision',
        userId: data.userId,
        latency: 0,
        success: true,
        metadata: {
            accuracy,
            detected: data.detectedIngredients.length,
            confirmed: data.confirmedIngredients.length,
        },
    });
}

/**
 * Calculate accuracy percentage
 */
function calculateAccuracy(detected: string[], confirmed: string[]): number {
    if (detected.length === 0) return 0;

    const correct = detected.filter(item =>
        confirmed.some(c => c.toLowerCase() === item.toLowerCase())
    ).length;

    return (correct / detected.length) * 100;
}

/**
 * Track recommendation quality
 */
export async function trackRecommendationQuality(data: {
    userId: string;
    recommendationId: string;
    clicked: boolean;
    saved: boolean;
}): Promise<void> {
    await trackEvent({
        event: 'recommendation_interaction',
        userId: data.userId,
        properties: data,
        timestamp: new Date(),
    });
}

/**
 * Track search relevance
 */
export async function trackSearchRelevance(data: {
    userId: string;
    query: string;
    resultsCount: number;
    clickPosition?: number;
}): Promise<void> {
    await trackEvent({
        event: 'search_performed',
        userId: data.userId,
        properties: data,
        timestamp: new Date(),
    });
}

/**
 * Error tracking
 */
export function trackError(error: Error, context?: Record<string, any>): void {
    console.error('[ERROR]', {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
    });

    // In production, send to Sentry
    // Sentry.captureException(error, { extra: context });
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
    private startTime: number;
    private operation: string;

    constructor(operation: string) {
        this.operation = operation;
        this.startTime = Date.now();
    }

    finish(success: boolean = true, metadata?: Record<string, any>): number {
        const duration = Date.now() - this.startTime;

        console.log(`[PERFORMANCE] ${this.operation}: ${duration}ms`, {
            success,
            ...metadata,
        });

        return duration;
    }
}

/**
 * Daily metrics aggregation (run via cron job)
 */
export async function aggregateDailyMetrics(): Promise<{
    visionScans: number;
    searches: number;
    recommendations: number;
    avgLatency: number;
    errorRate: number;
}> {
    // This would query the database/analytics service
    // For now, return mock data
    return {
        visionScans: 0,
        searches: 0,
        recommendations: 0,
        avgLatency: 0,
        errorRate: 0,
    };
}

/**
 * Health check for monitoring
 */
export async function healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    services: {
        database: boolean;
        auth: boolean;
        uploads: boolean;
        edgeAI: boolean;
    };
}> {
    try {
        // Check database connection
        const dbHealthy = await checkDatabaseHealth();

        // Check critical services configuration
        const authConfigured = !!process.env.CLERK_SECRET_KEY;
        const uploadsConfigured = !!process.env.UPLOADTHING_SECRET;
        // Edge AI (TensorFlow.js) runs client-side, always available
        const edgeAIAvailable = true;

        // App is healthy if DB + auth work; degraded if non-critical services missing
        const coreHealthy = dbHealthy && authConfigured;

        return {
            status: coreHealthy ? 'healthy' : dbHealthy ? 'degraded' : 'down',
            services: {
                database: dbHealthy,
                auth: authConfigured,
                uploads: uploadsConfigured,
                edgeAI: edgeAIAvailable,
            },
        };
    } catch (error) {
        return {
            status: 'down',
            services: {
                database: false,
                auth: false,
                uploads: false,
                edgeAI: true,
            },
        };
    }
}

async function checkDatabaseHealth(): Promise<boolean> {
    try {
        await db.$queryRaw`SELECT 1`;
        return true;
    } catch (error) {
        console.error('[Health] Database check failed:', error);
        return false;
    }
}
