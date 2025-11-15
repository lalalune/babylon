/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Specify workspace root to silence lockfile warning
  outputFileTracingRoot: process.cwd(),
  // Use standalone output for dynamic routes and API endpoints
  // Temporarily disabled for Next.js 16 compatibility
  // output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // instrumentationHook removed - available by default in Next.js 15+
  },
  // Skip prerendering for feed page (client-side only)
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: false,
  // Farcaster Mini App manifest serving
  async rewrites() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: '/farcaster.json',
      },
    ]
  },
  // Externalize packages with native Node.js dependencies for server-side
  serverExternalPackages: [
    'ipfs-http-client',
    '@helia/unixfs',
    'helia',
    'blockstore-core',
    'datastore-core',
    '@libp2p/interface',
    'electron-fetch',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Empty turbopack config to silence webpack/turbopack warning
  turbopack: {},
  // Webpack configuration for backward compatibility
  webpack: (config, { isServer }) => {
    // Fix for IPFS, electron-fetch, and React Native dependencies
    config.resolve.fallback = {
      ...config.resolve.fallback,
      electron: false,
      fs: false,
      net: false,
      tls: false,
      '@react-native-async-storage/async-storage': false,
    };

    // Externalize electron-fetch for server-side
    if (isServer) {
      // Ensure config.externals is an array before pushing
      if (!Array.isArray(config.externals)) {
        config.externals = [];
      }
      config.externals.push('electron');
    }

    return config;
  },
}

const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "symbaiex",

  project: "babylon",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Disable telemetry to suppress warnings during build
  telemetry: false,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

let resolvedConfig = nextConfig;

try {
  const { withSentryConfig } = await import('@sentry/nextjs');
  resolvedConfig = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
} catch (error) {
  const shouldLog = process.env.CI || process.env.NODE_ENV !== 'production';
  if (shouldLog) {
    console.warn(
      '[next.config.mjs] Sentry integration disabled. Falling back to base config.',
      error instanceof Error ? error.message : error
    );
  }
}

export default resolvedConfig;