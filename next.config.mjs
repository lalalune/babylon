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
      config.externals.push('electron');
    }

    return config;
  },
}

export default nextConfig
