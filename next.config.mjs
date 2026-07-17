/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pixi.js ships modern ESM; keep it out of server bundling paths.
  webpack: (config) => {
    config.externals = [...(config.externals || [])];
    return config;
  },
};

export default nextConfig;
