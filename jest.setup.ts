import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock Next.js router
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
        back: jest.fn(),
        pathname: '/',
        query: {},
        asPath: '/',
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
}));

// Mock Prisma Client
jest.mock('@/lib/db', () => ({
    db: {
        recipe: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        ingredient: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        visionLog: {
            create: jest.fn(),
        },
        recipeEmbedding: {
            findMany: jest.fn(),
        },
        ingredientEmbedding: {
            findMany: jest.fn(),
        },
    },
}));

// Suppress console errors in tests (optional)
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
};
