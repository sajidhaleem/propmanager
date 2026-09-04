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
 * Guests are grouped by CNIC first, then passport, then by name — a booking with
 * no identity at all gets no profile, because there is nothing to identify.
 *
 * Run once, after the schema reaches the target database:
 *   npx ts-node --project tsconfig.seed.json scripts/backfill-guests.ts
 */
import { PrismaClient } from '@prisma/client'

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

    // Nothing to build a profile from
    if (!cnic && !passport && !name) { skipped++; continue }

    /* Match on the identifiers that are actually unique to a person. Name is
       the last resort and only used when there is no document number at all —
       two different "Ahmed Khan" rows must not collapse into one person. */
    let guest =
      (cnic     ? await prisma.guest.findUnique({ where: { cnic } }) : null) ??
      (passport ? await prisma.guest.findUnique({ where: { passportNumber: passport } }) : null) ??
      (!cnic && !passport && name
        ? await prisma.guest.findFirst({ where: { name, cnic: null, passportNumber: null } })
        : null)

    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name:           name || cnic || passport || 'Unnamed guest',
          email:          clean(b.guestEmail),
          phone:          clean(b.guestPhone),
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
