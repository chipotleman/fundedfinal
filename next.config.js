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
    'https://*.replit.dev',
    'https://*.replit.app',
    'https://*.janeway.replit.dev'
  ],
}

module.exports = withPWA(nextConfig)
