/** @type {import('next').NextConfig} */

const fs = require('fs');
const path = require('path');

/** Load NEXT_PUBLIC_* from repo root .env (Next.js only reads apps/web/.env* by default). */
function loadRootPublicEnv() {
  const rootEnv = path.join(__dirname, '../../.env');
  if (!fs.existsSync(rootEnv)) return;
  for (const line of fs.readFileSync(rootEnv, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key.startsWith('NEXT_PUBLIC_')) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadRootPublicEnv();

const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Fallback for older clients; browser should call API directly (see src/lib/api.ts).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/v1/:path*',
      },
    ];
  },
  // Next.js defaults statically-prerendered pages (/, /dashboard, /dashboard/settings,
  // etc.) to `s-maxage=31536000` (one year), which assumes a CDN that invalidates on
  // deploy. This app is served directly from a single container with no CDN in front,
  // so every redeploy leaves returning visitors' browsers holding a stale HTML document
  // that references JS/CSS chunk hashes the new build no longer has -- a broken/unstyled
  // page until a hard refresh. Static assets under /_next/static/* are content-hashed and
  // safe to cache forever; only override the page documents themselves.
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
