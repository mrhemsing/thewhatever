import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/gallery', destination: '/', permanent: false },
      { source: '/post/:id', destination: '/', permanent: false },
      { source: '/:page(\\d+)', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
