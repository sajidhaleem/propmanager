/**
 * One-time backfill: build Guest profiles from the identity already sitting on
 * existing bookings, and link each booking to its profile.
 *
 * Bookings keep their own guestName/guestCnic columns — nothing is moved or
 * cleared. A filed Hotel Eye entry has to keep showing exactly what was filed
 * even if someone later edits or deletes the profile, so this only ADDS the
 * link. That also makes the script safe to re-run: bookings that already have a
 * guestId are skipped.
 *
 * Guests are grouped by CNIC first, then passport, then by name and number — a
 * booking with no identity at all gets no profile, because there is nothing to
 * identify. The matching rule is shared with the booking API (resolveGuestId),
 * so a re-run cannot disagree with what the app creates day to day.
 *
 * Safe to re-run at any time:
 *   npm run backfill:guests
 */
import { PrismaClient } from '@prisma/client'
import { sameGuest } from '../src/lib/guests'

const prisma = new PrismaClient()

const clean = (v?: string | null) => {
  const t = v?.trim()
  return t ? t : null
}

async function backfill() {
  console.log('🔄 Building guest profiles from existing bookings...')

  const bookings = await prisma.booking.findMany({
    where: { guestId: null },
    orderBy: { checkIn: 'asc' },
  })

  let created = 0
  let linked = 0
  let skipped = 0

  for (const b of bookings) {
    const cnic = clean(b.guestCnic)
    const passport = clean(b.passportNumber)
    const name = clean(b.guestName)
    const phone = clean(b.guestPhone)

    // Nothing to build a profile from
    if (!cnic && !passport && !name) { skipped++; continue }

    /* Match on the identifiers that are actually unique to a person first, then
       fall back to name + number. Two different "Ahmed Khan" rows with two
       different numbers stay two people. */
    let guest =
      (cnic     ? await prisma.guest.findUnique({ where: { cnic } }) : null) ??
      (passport ? await prisma.guest.findUnique({ where: { passportNumber: passport } }) : null)

    if (!guest && name) {
      const candidates = await prisma.guest.findMany({ where: { name: { equals: name, mode: 'insensitive' } } })
      guest = candidates.find(c => sameGuest({ name: c.name, phone: c.phone }, { name, phone })) ?? null
    }

    if (guest) {
      // The stay that finally carries a number completes the profile
      const fill: Record<string, string> = {}
      if (!guest.phone && phone) fill.phone = phone
      if (!guest.cnic && cnic) fill.cnic = cnic
      if (!guest.passportNumber && passport) fill.passportNumber = passport
      if (Object.keys(fill).length > 0) {
        await prisma.guest.update({ where: { id: guest.id }, data: fill }).catch(() => {})
      }
    } else {
      guest = await prisma.guest.create({
        data: {
          name:           name || cnic || passport || 'Unnamed guest',
          email:          clean(b.guestEmail),
          phone,
          cnic,
          fatherName:     clean(b.guestFatherName),
          gender:         clean(b.guestGender),
          address:        clean(b.guestAddress),
          province:       clean(b.guestProvince),
          district:       clean(b.guestDistrict),
          passportNumber: passport,
          nationality:    clean(b.nationality),
          passportExpiry: clean(b.passportExpiry),
        },
      })
      created++
    }

    await prisma.booking.update({ where: { id: b.id }, data: { guestId: guest.id } })
    linked++
  }

  console.log('✅ Done:')
  console.log(`   • ${created} guest profile(s) created`)
  console.log(`   • ${linked} booking(s) linked`)
  console.log(`   • ${skipped} booking(s) skipped (no name, CNIC or passport)`)
}

backfill()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
