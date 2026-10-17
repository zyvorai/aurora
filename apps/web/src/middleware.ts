import { NextResponse, type NextRequest } from 'next/server';

/**
 * Same-origin API proxy for prebuilt images.
 *
 * The browser bundle calls a relative `/api/v1` (NEXT_PUBLIC_API_URL=/api/v1 at build time), and this middleware
 * forwards it to `API_INTERNAL_URL` -- read at *runtime*, so one image works on localhost, any VM host name, or
 * Kubernetes (`http://aurora-api:8000`). Without API_INTERNAL_URL (local dev, split-origin deployments) it does nothing.
 */
export function middleware(req: NextRequest) {
  const upstream = process.env.API_INTERNAL_URL?.replace(/\/$/, '');
  if (!upstream) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  return NextResponse.rewrite(new URL(`${pathname}${search}`, `${upstream}/`));
}

export const config = { matcher: ['/api/v1/:path*'] };
