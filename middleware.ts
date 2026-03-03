import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'

const CLERK_CONFIGURED = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
)

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/recipes', // Main recipes browse page
    '/recipes/:id', // Individual recipe viewing (using path-to-regexp syntax)
    '/api/(.*)', // All API routes handle their own auth internally
])

const clerkAuthMiddleware = clerkMiddleware(async (auth, request) => {
    const url = new URL(request.url);

    // Protect recipe creation - require authentication
    if (url.pathname === '/recipes/create') {
        await auth.protect();
        return;
    }

    // Protect all other non-public routes
    if (!isPublicRoute(request)) {
        await auth.protect()
    }
})

export default function middleware(request: NextRequest, event: NextFetchEvent) {
    // Always run Clerk middleware so auth() context is available in API routes.
    // clerkMiddleware by itself doesn't block unauthenticated users —
    // it just sets up the auth context. Route protection is handled inside
    // the clerkAuthMiddleware callback via auth.protect().
    if (!CLERK_CONFIGURED) {
        return NextResponse.next();
    }

    return clerkAuthMiddleware(request, event);
}

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
