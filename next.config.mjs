/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['react-map-gl', 'mapbox-gl'],
};

export default nextConfig;
