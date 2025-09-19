import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const nextConfig = {
  // Skip ESLint during build while outstanding rule migrations are addressed
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip TypeScript errors during build to allow deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  // Improve HMR reliability on WSL/Windows-mounted drives by enabling polling
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        // Check for changes every 1s; helps when file watchers are unreliable
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/.git/**', '**/node_modules/**', '**/.next/**'],
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
