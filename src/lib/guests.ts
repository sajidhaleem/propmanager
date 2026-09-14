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
  /* Do-not-book record — read through guestRiskStatus(), never field by field,
     so an unrecognised level cannot be shown to the desk as a warning nobody
     can explain. */
  riskLevel?: string | null
  riskReason?: string | null
  riskNote?: string | null
  riskSetBy?: string | null
  riskSetAt?: string | Date | null
  riskReviewAt?: string | Date | null
  _count?: { bookings: number }
}

/* Every field the desk can leave empty is nullish, not merely optional.
   The API stores a blank as null and hands null back on read, so a schema that
   accepted only `string | undefined` refused the exact record it had just
   returned: editing a guest with no email address failed on save, and the union
   reported it as the bare Zod default, "Invalid input" — a message naming
   neither the field nor the reason. */
const optionalText = () => z.string().nullish()

export const guestSchema = z.object({
  name:           z.string().min(2, 'Guest name is required'),
  email:          z.string().email('Enter a valid email address').or(z.literal('')).nullish(),
  phone:          optionalText(),
  cnic:           optionalText(),
  fatherName:     optionalText(),
  gender:         optionalText(),
  address:        optionalText(),
  province:       optionalText(),
  district:       optionalText(),
  passportNumber: optionalText(),
  nationality:    optionalText(),
  passportExpiry: optionalText(),
  notes:          optionalText(),
})

/**
 * What a stay can teach a profile: the fields it holds that the profile does not.
 *
 * Only blanks are filled, in one direction. Two rules make that the right call:
 * a later stay that omits a field must never wipe what an earlier one recorded,
 * and the profile is the edited copy, so a value someone corrected by hand
 * outranks whatever a scan read off a photograph afterwards.
 *
 * Whitespace counts as blank on both sides. A profile holding " " is missing
 * the field, and an incoming " " teaches nothing.
 */
export function fillBlanks<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<Record<keyof T, string | null | undefined>>,
): Partial<Record<keyof T, string>> {
  const out: Partial<Record<keyof T, string>> = {}
  const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0

  for (const key of Object.keys(incoming) as (keyof T)[]) {
    const value = incoming[key]
    if (filled(value) && !filled(existing[key])) out[key] = (value as string).trim()
  }
  return out
}

/**
 * A saved profile, in the shape a booking stores it.
 *
 * Empty fields are left out rather than written as '', so spreading this over a
 * form or a request body fills what the profile knows and disturbs nothing
 * else. Picking a guest anywhere in the app goes through here, so a stay taken
 * from the calendar carries the same identity as one taken from the full
 * booking form — which is what a Hotel Eye filing needs.
 */
export function guestIdentityFields(g: Guest): Record<string, string> {
  const fromProfile: Record<string, string | null | undefined> = {
    guestName:       g.name,
    guestEmail:      g.email,
    guestPhone:      g.phone,
    guestCnic:       g.cnic,
    guestFatherName: g.fatherName,
    guestGender:     g.gender,
    guestAddress:    g.address,
    guestProvince:   g.province,
    guestDistrict:   g.district,
    passportNumber:  g.passportNumber,
    nationality:     g.nationality,
    passportExpiry:  g.passportExpiry,
  }

  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(fromProfile)) {
    if (value && value.trim()) out[key] = value.trim()
  }
  return out
}

/**
 * A CNIC in the one form the app stores: 35202-1234567-1.
 *
 * The unique index that is supposed to stop one person having two profiles
 * compares the stored string, so it only works if every desk writes the number
 * the same way — and they do not. 3520212345671, 35202 1234567 1 and
 * 35202-1234567-1 are the same national identity card and used to be three
 * guests. The digits are the identity; the dashes are how the card prints it.
 *
 * Anything that is not thirteen digits is left alone rather than reshaped: a
 * half-typed or foreign number should be stored as given, not silently turned
 * into something that looks official.
 */
export function normalizeCnic(cnic?: string | null): string | null {
  const raw = cnic?.trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 13) return raw
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

/**
 * Passport numbers, upper-cased with separators removed.
 *
 * Same problem as the CNIC in a smaller form: "ab 1234567" and "AB1234567" are
 * one document, and the index cannot see that.
 */
export function normalizePassport(passport?: string | null): string | null {
  const raw = passport?.trim()
  if (!raw) return null
  const compact = raw.replace(/[\s-]/g, '').toUpperCase()
  return compact || null
}

/**
 * Canonicalise the two identifiers a guest is matched on, wherever a profile is
 * written. Applied server-side so every path — the guest form, a booking, a
 * scanned card — goes through it, rather than trusting each caller.
 */
export function normalizeGuestIdentity<T extends { cnic?: unknown; passportNumber?: unknown }>(data: T): T {
  const out = { ...data }
  if ('cnic' in data) out.cnic = normalizeCnic(data.cnic as string | null) as T['cnic']
  if ('passportNumber' in data) {
    out.passportNumber = normalizePassport(data.passportNumber as string | null) as T['passportNumber']
  }
  return out
}

/**
 * Every form of a search term worth looking for.
 *
 * The desk searches the way the number is printed on the card in their hand,
 * which is not always the way it was typed the day the profile was made. A
 * search that misses is what creates the duplicate: nothing comes back, so a
 * second profile gets made for someone already on file.
 */
export function guestSearchVariants(search?: string | null): string[] {
  const term = search?.trim()
  if (!term) return []

  const variants = new Set([term])
  const asCnic = normalizeCnic(term)
  if (asCnic) variants.add(asCnic)
  const asPassport = normalizePassport(term)
  if (asPassport) variants.add(asPassport)
  // bare digits, so a stored 35202-1234567-1 is found by 3520212345671
  const digits = term.replace(/\D/g, '')
  if (digits) variants.add(digits)

  return [...variants]
}

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
