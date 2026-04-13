import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone output only when you need a self-contained Node deployment.
  ...(process.env.STANDALONE === 'true' ? { output: 'standalone' as const } : {}),

  // Security: Limit request body size to prevent DoS attacks
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // Allow image uploads for recipe scanning
    },
  },

  // Turbopack config (Next.js 16 default bundler) - empty config silences conflict error
  turbopack: {},

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
      // Allow locally-uploaded images served in dev/Docker
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
    ],
    // Allow unoptimized images from public/uploads during dev
    unoptimized: process.env.NODE_ENV === 'development',
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
            value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), vr=(), xr=()' // Allow camera and microphone for scanner voice mode
          },
          {
            // Content Security Policy for Edge AI (TensorFlow.js, Transformers.js)
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.dev https://*.clerk.com https://clerk.browser.js", // Required for Next.js hydration & Clerk
              "worker-src 'self' blob:", // WebWorkers for AI inference
              "img-src 'self' data: blob: https://utfs.io https://img.clerk.com https://images.clerk.dev https://*.clerk.accounts.dev https://*.clerk.dev https://*.clerk.com", // Camera captures + UploadThing + Clerk avatars
              "style-src 'self' 'unsafe-inline'", // Required for some UI libraries
              "font-src 'self' data:", // Web fonts
              "connect-src 'self' https://api.clerk.com https://utfs.io https://*.uploadthing.com wss://*.clerk.accounts.dev https://*.clerk.accounts.dev https://*.clerk.dev https://*.clerk.com https://storage.googleapis.com https://tfhub.dev https://cdn.jsdelivr.net", // API connections + TensorFlow model downloads
              "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://*.clerk.com", // Embedded Clerk widgets and auth flows
              "frame-ancestors 'none'", // Prevent clickjacking
              "base-uri 'self'",
              "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://*.clerk.com",
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
            value: process.env.NODE_ENV === 'development'
              ? 'http://localhost:3000'
              : (process.env.ALLOWED_ORIGINS || 'https://fooxchange.com')
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

  // Dev stability: ignore huge training/artifact folders during file watch.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: [
          '**/.git/**',
          '**/.next/**',
          '**/.venv/**',
          '**/training/**',
          '**/training_imageset/**',
          '**/runs/**',
          '**/ALL SETUP/**',
          '**/node_modules/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;

