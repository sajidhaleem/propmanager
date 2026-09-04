/**
 * One-time backfill: give each guest a copy of the card images that were filed
 * against their bookings before scans belonged to the guest.
 *
 * Without this, "the system will not ask to scan again" is only true for guests
 * scanned after the change — every earlier guest's card sits on a booking, with
 * no kind, and the desk gets asked for a card the app already holds.
 *
 * The booking's own copy is deliberately left in place rather than moved. The
 * two relations both cascade on delete, so a single row attached to both would
 * mean deleting a tidied-up duplicate profile also destroyed a stay's filing
 * evidence. Copying costs a few small images and keeps that impossible.
 *
 * Safe to re-run: a guest that already has a document of the same name is
 * skipped.
 *
 *   npm run backfill:scans
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * What card an uploaded file is, read from its name. These were named by hand
 * ("Ali Khan - Front.jpeg"), so anything that does not clearly say is left
 * unlabelled rather than guessed — a wrong kind would tell the desk a card is
 * on file when it is not.
 */
function kindFromName(name: string): string | null {
  const n = name.toLowerCase()
  if (/passport/.test(n)) return 'PASSPORT'
  if (/(^|[\s_·-])front(\b|[\s_.-])/.test(n)) return 'CNIC_FRONT'
  if (/(^|[\s_·-])back(\b|[\s_.-])/.test(n)) return 'CNIC_BACK'
  return null
}

async function backfill() {
  console.log('🔄 Copying booking card images onto their guest profiles...')

  const docs = await prisma.document.findMany({
    where: { bookingId: { not: null }, guestId: null },
    include: { booking: { select: { guestId: true } } },
    orderBy: { createdAt: 'asc' },
  })

  let copied = 0
  let labelled = 0
  let skipped = 0

  for (const d of docs) {
    const guestId = d.booking?.guestId
    if (!guestId) { skipped++; continue }

    const already = await prisma.document.findFirst({
      where: { guestId, name: d.name },
      select: { id: true },
    })
    if (already) { skipped++; continue }

    const kind = kindFromName(d.name)
    await prisma.document.create({
      data: {
        guestId,
        kind,
        name: d.name,
        mimeType: d.mimeType,
        size: d.size,
        data: d.data,
      },
    })
    copied++
    if (kind) labelled++
  }

  console.log('✅ Done:')
  console.log(`   • ${copied} image(s) copied to a guest profile`)
  console.log(`   • ${labelled} of those recognised as a CNIC side or passport`)
  console.log(`   • ${skipped} skipped (no guest on the booking, or already copied)`)
}

backfill()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
