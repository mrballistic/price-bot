/** @type {import('next').NextConfig} */
const basePath = process.env.PAGES_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // GitHub Pages serves from /<repo-name>/ - set via env var in CI
  basePath,
  images: {
    unoptimized: true, // Required for static export
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
