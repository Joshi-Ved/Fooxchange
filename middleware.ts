import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/recipes',            // Main recipes browse page
    '/recipes/create',     // Recipe creation page (auth checked in server action)
    '/recipes/:id',        // Individual recipe viewing
    '/api/health',         // Health check for ALB/monitoring
    '/api/uploadthing(.*)', // Upload endpoint (has its own auth)
    '/api/recipes/sync',   // Background sync endpoint (has its own auth)
])

export default clerkMiddleware(async (auth, request) => {
    // Allow public routes through without auth
    if (isPublicRoute(request)) {
        return;
    }

    // For all other routes, require authentication
    // auth.protect() will redirect to the sign-in page
    await auth.protect()
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}

