/**
 * In-memory rate limiter for production use without Redis.
 * For high-traffic production: swap for @upstash/ratelimit + Redis.
 */

interface RateLimitStore {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitStore>()

// Clean up expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((v, k) => { if (v.resetAt < now) store.delete(k) })
  }, 60_000)
}

export interface RateLimitConfig {
  windowMs: number  // window duration in ms
  max: number       // max requests per window
}

const PRESETS = {
  auth: { windowMs: 15 * 60 * 1000, max: 10 },       // 10 attempts / 15 min
  api:  { windowMs: 60 * 1000, max: 120 },             // 120 req/min
  strict: { windowMs: 60 * 1000, max: 20 },            // 20 req/min
}

export function rateLimit(key: string, preset: keyof typeof PRESETS = 'api') {
  const config = PRESETS[preset]
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { success: true, remaining: config.max - 1, resetAt: now + config.windowMs }
  }

  entry.count++
  const remaining = Math.max(0, config.max - entry.count)
  const success = entry.count <= config.max

  return { success, remaining, resetAt: entry.resetAt }
}

export function getRateLimitHeaders(result: ReturnType<typeof rateLimit>) {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    'Retry-After': result.success ? undefined : String(Math.ceil((result.resetAt - Date.now()) / 1000)),
  }
}
