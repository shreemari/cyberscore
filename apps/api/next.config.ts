import type { NextConfig } from 'next';

// On Vercel we let their build adapter handle output packaging. Outside
// Vercel (self-hosted Docker, etc.) we want a standalone build so the image
// can be small.
const isVercel = !!process.env.VERCEL;

const config: NextConfig = {
  reactStrictMode: true,
  // API-only app. No frontend pages.
  ...(isVercel ? {} : { output: 'standalone' as const }),
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', 'argon2', 'bullmq', 'ioredis'],
  // Skip Next's built-in TS + ESLint checks at build time. We run `tsc
  // --noEmit` and lint via Turbo in CI / pre-commit; doing it twice in
  // `next build` is wasted minutes and surfaces false positives when the
  // build environment (Vercel's Node 24, fresh install tree) resolves
  // modules differently from local dev (Node 22, hoisted workspace deps).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // API routes only — keep bundle small
    typedRoutes: false,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default config;
