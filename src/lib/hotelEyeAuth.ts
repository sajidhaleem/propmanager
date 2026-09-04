import { timingSafeEqual } from 'node:crypto'

/**
 * Shared-secret check for the Hotel Eye worker endpoints (`/api/hotel-eye/poll`).
 *
 * Server-only — it is deliberately not in `src/lib/hotelEye.ts`, which client
 * components import, because that would pull node:crypto into the browser bundle.
 *
 * Fails CLOSED when HOTEL_EYE_SECRET is unset. That is the safe direction, but
 * it is silent: a deploy that forgets the variable rejects every poll with 403,
 * so jobs queue and no guest is ever filed. Both .env examples and PRODUCTION.md
 * now call this out.
 */
export function hotelEyeSecretValid(token: string | null | undefined): boolean {
  const expected = process.env.HOTEL_EYE_SECRET || ''
  if (!expected) return false

  const a = Buffer.from(token || '', 'utf8')
  const b = Buffer.from(expected, 'utf8')
  /* timingSafeEqual throws on a length mismatch, and the lengths themselves are
     not secret, so check that first and compare the bytes without an early exit. */
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
