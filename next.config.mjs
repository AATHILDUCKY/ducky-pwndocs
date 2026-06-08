/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 ships a native binding that must not be bundled by webpack.
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { dev }) => {
    // Prevent intermittent ENOENT crashes from corrupted/missing webpack pack cache files in dev.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
