/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Prevent intermittent ENOENT crashes from corrupted/missing webpack pack cache files in dev.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
