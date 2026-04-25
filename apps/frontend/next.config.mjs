import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['@shared/types'] = path.resolve(__dirname, '../../packages/shared/src/index.ts');
    return config;
  },
};

export default nextConfig;
