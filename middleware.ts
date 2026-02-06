import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/recipes$', // Only the main recipes page (browsing)
    '/recipes/[^/]+$', // Individual recipe viewing (e.g., /recipes/abc123)
    '/api/uploadthing(.*)', // Public upload endpoint
])

export default clerkMiddleware(async (auth, request) => {
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

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
