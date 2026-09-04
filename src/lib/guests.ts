import { z } from 'zod'

export type Guest = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  cnic?: string | null
  fatherName?: string | null
  gender?: string | null
  address?: string | null
  province?: string | null
  district?: string | null
  passportNumber?: string | null
  nationality?: string | null
  passportExpiry?: string | null
  notes?: string | null
  _count?: { bookings: number }
}

export const guestSchema = z.object({
  name:           z.string().min(2, 'Guest name is required'),
  email:          z.string().email().or(z.literal('')).optional(),
  phone:          z.string().optional(),
  cnic:           z.string().optional(),
  fatherName:     z.string().optional(),
  gender:         z.string().optional(),
  address:        z.string().optional(),
  province:       z.string().optional(),
  district:       z.string().optional(),
  passportNumber: z.string().optional(),
  nationality:    z.string().optional(),
  passportExpiry: z.string().optional(),
  notes:          z.string().optional(),
})

/**
 * The same number is typed as 0307 113 0001, +92 307 1130001 and 03071130001.
 * Compare the national digits only, or one person ends up with three profiles.
 */
export function normalizePhone(phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '')
  return digits.replace(/^(92|0)+/, '')
}

export function normalizeName(name?: string | null): string {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Whether two bookings are the same person, judged on name and number alone
 * (documents are matched separately, by their unique index).
 *
 * A blank number matches a known one for the same name: the desk records the
 * number on the stay it was asked for and leaves it off the rest, so treating
 * blank as "different person" is how one guest becomes eleven profiles. Two
 * different numbers stay apart — that is the case where they really are two
 * people who share a name.
 */
export function sameGuest(
  a: { name?: string | null; phone?: string | null },
  b: { name?: string | null; phone?: string | null },
): boolean {
  if (!normalizeName(a.name) || normalizeName(a.name) !== normalizeName(b.name)) return false
  const pa = normalizePhone(a.phone)
  const pb = normalizePhone(b.phone)
  return !pa || !pb || pa === pb
}

/**
 * '' is what an untouched form field sends. Storing it would defeat the unique
 * index on cnic/passportNumber — the second guest saved with a blank CNIC would
 * collide with the first instead of both being "no CNIC on file".
 */
export function blankToNull<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
  ) as { [K in keyof T]: T[K] | null }
}
