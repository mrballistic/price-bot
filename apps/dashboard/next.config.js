/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // GitHub Pages serves from /<repo-name>/ - set via env var in CI
  basePath: process.env.PAGES_BASE_PATH || '',
  images: {
    unoptimized: true, // Required for static export
  },
};

module.exports = nextConfig;
