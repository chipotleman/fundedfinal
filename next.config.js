/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'static-js-css',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24,
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
})

const nextConfig = {
  reactStrictMode: true,
  // Emit `.js.map` files for client chunks under `.next/static`.
  // `scripts/measure-bundle.js` parses them with `source-map-explorer`
  // to produce a per-chunk module breakdown, which the bundle-budget
  // CI check uses to point at the modules behind a regression
  // (see docs/bundle-budget.md). The maps themselves are excluded
  // from the bundle-size measurement so the budget keeps tracking
  // user-served JS only.
  productionBrowserSourceMaps: true,
  experimental: {
    instrumentationHook: true,
  },
  allowedDevOrigins: [
    '*.replit.dev',
    '*.janeway.replit.dev', 
    '*.repl.co',
    'a01a394d-2456-4999-a4ea-cf4251dbb624-00-2sfh6gnzo798j.janeway.replit.dev'
  ],
  async redirects() {
    return [
      {
        source: '/battles',
        destination: '/battle',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/objects/:path*',
        destination: '/api/objects/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      aggregateTimeout: 300,
      poll: 1000,
      ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**']
    };
    return config;
  },
}

module.exports = withPWA(nextConfig)
