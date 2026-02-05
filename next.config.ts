import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security: Limit request body size to prevent DoS attacks
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // Limit for server actions
    },
  },

  // Webpack configuration for AI models (TensorFlow.js, Transformers.js)
  webpack: (config, { isServer }) => {
    // Handle WASM files for TensorFlow.js
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle ONNX model files for Transformers.js
    config.module.rules.push({
      test: /\.onnx$/,
      type: 'asset/resource',
    });

    // Handle binary files
    config.module.rules.push({
      test: /\.(wasm|onnx)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[path][name].[hash][ext]',
      },
    });

    return config;
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
            value: 'camera=(self), microphone=(), geolocation=()' // Allow camera for ingredient scanning
          },
          {
            // Content Security Policy for Edge AI (TensorFlow.js, Transformers.js)
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'", // WASM for TensorFlow.js
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
            value: process.env.ALLOWED_ORIGINS || '*' // Configure in production
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

