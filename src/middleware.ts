import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { rateLimit, getRateLimitHeaders } from '@/lib/rateLimit'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/health',
  '/manifest.json',
  '/sw.js',
  '/icons',
  '/offline.html',
  '/.well-known',
  '/api/hotel-eye/poll',
]

const SECURITY_HEADERS = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-XSS-Protection': '1; mode=block',
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

  // ── Skip static files and Next.js internals ──
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next()
  }

  // ── Rate limiting ──
  const isAuthPath = pathname === '/api/auth/login'
  const limiterKey = `${isAuthPath ? 'auth' : 'api'}:${ip}`
  const limitResult = rateLimit(limiterKey, isAuthPath ? 'auth' : 'api')
  const limitHeaders = getRateLimitHeaders(limitResult)

  if (!limitResult.success) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Too many requests. Please slow down.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(
            Object.entries(limitHeaders).filter(([, v]) => v !== undefined) as [string, string][]
          ),
        },
      }
    )
  }

  // ── Allow public paths ──
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const res = NextResponse.next()
    applySecurityHeaders(res, limitHeaders)
    return res
  }

  const INACTIVITY_MAX = 30 * 60  // 30 minutes in seconds

  // ── Authenticate API routes ──
  if (pathname.startsWith('/api/')) {
    const token = req.cookies.get('auth-token')?.value
    if (!token) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const payload = await verifyToken(token)
    if (!payload) {
      const res = new NextResponse(
        JSON.stringify({ success: false, error: 'Session expired. Please log in again.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
      res.cookies.delete('auth-token')
      res.cookies.delete('last-activity')
      return res
    }
    // Enforce inactivity timeout — the cookie has maxAge = INACTIVITY_MAX,
    // so a missing cookie means it expired (or was deleted): fail closed
    const lastActivity = req.cookies.get('last-activity')?.value
    const elapsed = lastActivity ? (Date.now() - parseInt(lastActivity, 10)) / 1000 : Infinity
    if (elapsed > INACTIVITY_MAX) {
      const res = new NextResponse(
        JSON.stringify({ success: false, error: 'Session expired due to inactivity.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
      res.cookies.delete('auth-token')
      res.cookies.delete('last-activity')
      return res
    }
    const res = NextResponse.next()
    res.headers.set('X-User-Id', payload.userId)
    res.headers.set('X-User-Role', payload.role)
    res.cookies.set('last-activity', String(Date.now()), {
      httpOnly: true, secure: true, sameSite: 'lax',
      maxAge: INACTIVITY_MAX, path: '/',
    })
    applySecurityHeaders(res, limitHeaders)
    return res
  }

  // ── Protect dashboard pages ──
  if (pathname.startsWith('/dashboard') || pathname === '/') {
    const token = req.cookies.get('auth-token')?.value
    if (!token) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const payload = await verifyToken(token)
    if (!payload) {
      const response = NextResponse.redirect(new URL('/login', req.url))
      response.cookies.delete('auth-token')
      response.cookies.delete('last-activity')
      return response
    }
    // Enforce inactivity timeout on page navigation too (missing cookie = expired)
    const lastActivity = req.cookies.get('last-activity')?.value
    const elapsed = lastActivity ? (Date.now() - parseInt(lastActivity, 10)) / 1000 : Infinity
    if (elapsed > INACTIVITY_MAX) {
      const response = NextResponse.redirect(new URL('/login?reason=inactivity', req.url))
      response.cookies.delete('auth-token')
      response.cookies.delete('last-activity')
      return response
    }
    // Refresh the activity cookie on page visits
    const res = NextResponse.next()
    res.cookies.set('last-activity', String(Date.now()), {
      httpOnly: true, secure: true, sameSite: 'lax',
      maxAge: INACTIVITY_MAX, path: '/',
    })
    applySecurityHeaders(res, limitHeaders)
    return res
  }

  // ── Redirect logged-in users away from login ──
  if (pathname === '/login') {
    const token = req.cookies.get('auth-token')?.value
    if (token) {
      const payload = await verifyToken(token)
      if (payload) return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  const res = NextResponse.next()
  applySecurityHeaders(res, limitHeaders)
  return res
}

function applySecurityHeaders(
  res: NextResponse,
  extra: Record<string, string | undefined> = {}
) {
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  Object.entries(extra).forEach(([k, v]) => { if (v) res.headers.set(k, v) })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|public).*)',
  ],
}
