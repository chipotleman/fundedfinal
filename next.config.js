/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
})

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    '*.replit.dev',
    '*.janeway.replit.dev', 
    '*.repl.co',
    'a01a394d-2456-4999-a4ea-cf4251dbb624-00-2sfh6gnzo798j.janeway.replit.dev'
  ],
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
