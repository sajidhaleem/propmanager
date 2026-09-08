import { prisma } from '@/lib/db'
import { sameGuest, fillBlanks } from '@/lib/guests'

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
    /* Fill in everything the profile is missing, not just the document numbers.
       A card scanned on a booking reads the father's name, gender and address
       too, and those were reaching the booking's own columns and stopping
       there — so a profile could stay half empty while the stay beside it held
       the whole card.

       Only blanks are filled. A later stay that happens to omit a field must
       never wipe what an earlier one recorded, and the guest profile is the
       edited copy: what someone corrected by hand outranks what a scan read. */
    const fill = fillBlanks(guest, {
      phone,
      email:          b.guestEmail,
      cnic,
      fatherName:     b.guestFatherName,
      gender:         b.guestGender,
      address:        b.guestAddress,
      province:       b.guestProvince,
      district:       b.guestDistrict,
      passportNumber: passport,
      nationality:    b.nationality,
      passportExpiry: b.passportExpiry,
    })

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
