import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" nur für Docker, Vercel braucht es nicht
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),

  // Sharp muss als externes Paket behandelt werden (native Binaries)
  serverExternalPackages: ['sharp'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
