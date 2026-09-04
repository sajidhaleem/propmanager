import { prisma } from '@/lib/db'
import { sameGuest } from '@/lib/guests'

/** Server-only: touches the database, so keep it out of guests.ts (client imports that). */

type BookingIdentity = {
  guestName?: string | null
  guestEmail?: string | null
  guestPhone?: string | null
  guestCnic?: string | null
  guestFatherName?: string | null
  guestGender?: string | null
  guestAddress?: string | null
  guestProvince?: string | null
  guestDistrict?: string | null
  passportNumber?: string | null
  nationality?: string | null
  passportExpiry?: string | null
}

const clean = (v?: string | null) => {
  const t = v?.trim()
  return t ? t : null
}

/**
 * Find the guest this booking belongs to, creating the profile if it is a new
 * person. Called on every booking write that did not pick a guest by hand —
 * without it the guest list only ever holds whoever existed at backfill time,
 * and every booking taken since is a person with no profile.
 *
 * Match order is CNIC, then passport, then name + number: the first two are
 * unique to a person, the last is a judgement (see sameGuest).
 */
export async function resolveGuestId(b: BookingIdentity): Promise<string | null> {
  const cnic = clean(b.guestCnic)
  const passport = clean(b.passportNumber)
  const name = clean(b.guestName)
  const phone = clean(b.guestPhone)

  if (!cnic && !passport && !name) return null

  let guest =
    (cnic ? await prisma.guest.findUnique({ where: { cnic } }) : null) ??
    (passport ? await prisma.guest.findUnique({ where: { passportNumber: passport } }) : null)

  if (!guest && name) {
    // Postgres has no case-insensitive equality without citext, so narrow on the
    // indexed name and let sameGuest judge the number.
    const candidates = await prisma.guest.findMany({
      where: { name: { equals: name, mode: 'insensitive' } },
    })
    guest = candidates.find(c => sameGuest({ name: c.name, phone: c.phone }, { name, phone })) ?? null
  }

  if (guest) {
    /* Fill in what the profile is missing without overwriting anything: the
       stay that finally carries a phone number or a CNIC should complete the
       profile, but a later blank field must not wipe it. */
    const fill: Record<string, string> = {}
    if (!guest.phone && phone) fill.phone = phone
    if (!guest.cnic && cnic) fill.cnic = cnic
    if (!guest.passportNumber && passport) fill.passportNumber = passport
    if (!guest.email && clean(b.guestEmail)) fill.email = clean(b.guestEmail)!
    if (Object.keys(fill).length > 0) {
      // A racing write can claim the unique cnic/passport first; the link still stands
      await prisma.guest.update({ where: { id: guest.id }, data: fill }).catch(() => {})
    }
    return guest.id
  }

  const created = await prisma.guest.create({
    data: {
      name: name || cnic || passport || 'Unnamed guest',
      email: clean(b.guestEmail),
      phone,
      cnic,
      fatherName: clean(b.guestFatherName),
      gender: clean(b.guestGender),
      address: clean(b.guestAddress),
      province: clean(b.guestProvince),
      district: clean(b.guestDistrict),
      passportNumber: passport,
      nationality: clean(b.nationality),
      passportExpiry: clean(b.passportExpiry),
    },
  })
  return created.id
}
