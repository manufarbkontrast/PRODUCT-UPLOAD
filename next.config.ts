import type { NextConfig } from "next";
import path from "path";

// Einzige Quelle für den Base-Path: läuft die App auf dem gemeinsamen Hetzner-Host
// (167.233.218.238) neben brain-cockpit, unter dem Pfad "/erfassung" – damit das
// Supabase-Auth-Cookie (Single-Sign-On mit dem Cockpit auf "/") funktioniert.
// basePath UND assetPrefix UND die client-sichtbare NEXT_PUBLIC_BASE_PATH-Variable
// leiten sich alle von dieser einen Konstante ab (kein doppeltes "/erfassung" im Code).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/erfassung';

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  env: {
    // Macht denselben Wert für lib/base-path.ts (Client + Server) verfügbar,
    // ohne ihn separat pflegen zu müssen.
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },

  // Verhindert, dass Turbopack bei mehreren Lockfiles auf dem Entwickler-Rechner
  // (z.B. ein weiteres package-lock.json in einem übergeordneten Verzeichnis)
  // ein falsches Workspace-Root errät und den Standalone-Output verschachtelt.
  turbopack: {
    root: path.join(__dirname),
  },

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
