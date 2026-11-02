/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@asteai/types'],
  experimental: {
    // App Router is the default in Next 14
  },
  images: {
    domains: ['asteai.com'],
  },
  async rewrites() {
    return [
      {
        // Proxy all /api/v1/* calls to the NestJS backend during development
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
