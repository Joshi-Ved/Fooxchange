/**
 * Prisma Client Instance
 * 
 * Production-ready Prisma client singleton to prevent connection exhaustion
 * in development hot-reload scenarios.
 * 
 * In development: Reuses client across module reloads
 * In production: Creates single instance
 */

import { PrismaClient } from './generated/prisma';

// Extend global type for development singleton
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

/**
 * Prisma client with connection pooling and logging
 */
export const db =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === 'development'
                ? ['error', 'warn'] // Reduced logging to avoid noise
                : ['error'], // Error-only in production
    });

// In development, store client in global to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = db;
}

/**
 * Graceful shutdown handler
 * Call this before app termination to close DB connections properly
 */
export async function disconnectDB() {
    await db.$disconnect();
}
