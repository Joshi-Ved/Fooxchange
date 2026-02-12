import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone output only for Docker/ECS deployments (set STANDALONE=true)
  // AWS Amplify has its own SSR adapter - do NOT enable standalone there
  ...(process.env.STANDALONE === 'true' ? { output: 'standalone' as const } : {}),

  // Security: Limit request body size to prevent DoS attacks
  experimental: {
    serverActions: {
      bodySizeLimit: '50kb', // Strict limit for recipe metadata
    },
  },

  // Allow external images from UploadThing and Clerk
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: '*.ufs.sh',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), vr=(), xr=()' // Allow camera only, block everything else
          },
          {
            // Content Security Policy for Edge AI (TensorFlow.js, Transformers.js)
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'wasm-unsafe-eval'", // WASM for TensorFlow.js (removed unsafe-eval)
              "worker-src 'self' blob:", // WebWorkers for AI inference
              "img-src 'self' data: blob: https://utfs.io https://img.clerk.com", // Camera captures + UploadThing + Clerk avatars
              "style-src 'self' 'unsafe-inline'", // Required for some UI libraries
              "font-src 'self' data:", // Web fonts
              "connect-src 'self' https://api.clerk.com https://utfs.io https://*.uploadthing.com wss://*.clerk.accounts.dev", // API connections
              "frame-ancestors 'none'", // Prevent clickjacking
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; ')
          },
        ],
      },
      {
        // CORS for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || 'https://fooxchange.com' // NO wildcard - explicit origin required
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400' // 24 hours
          },
        ],
      },
    ];
  },
};

export default nextConfig;

