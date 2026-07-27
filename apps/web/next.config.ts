/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      resolveAlias: {
        '@car-rental/core': '../../packages/core/src',
        '@car-rental/db': '../../packages/db/src',
        '@car-rental/auth': '../../packages/auth/src',
        '@car-rental/billing': '../../packages/billing/src',
        '@car-rental/api-contracts': '../../packages/api-contracts/src',
      },
    },
  },
  transpilePackages: [
    '@car-rental/core',
    '@car-rental/db',
    '@car-rental/auth',
    '@car-rental/billing',
    '@car-rental/api-contracts',
  ],
};

module.exports = nextConfig;