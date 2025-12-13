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
    '127.0.0.1',
    'localhost',
    '*.replit.dev',
    '*.janeway.replit.dev',
    'a01a394d-2456-4999-a4ea-cf4251dbb624-00-2sfh6gnzo798j.janeway.replit.dev'
  ],
}

module.exports = withPWA(nextConfig)
