/** @type {import('next').NextConfig} */
const path = require('path');
const basePath = process.env.PAGES_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // Monorepo root - silences lockfile warning
  outputFileTracingRoot: path.join(__dirname, '../../'),
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
