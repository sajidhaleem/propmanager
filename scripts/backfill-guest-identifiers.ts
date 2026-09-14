/**
 * One-time backfill: rewrite every stored CNIC and passport number into the one
 * canonical form the app now writes.
 *
 * The unique index that stops one person having two profiles compares stored
 * strings, so it only ever worked for desks that typed the number the same way.
 * Rows saved before normalisation still hold 3520212345671 or "ab 1234567", and
 * until they are rewritten the index cannot see that they are the same person as
 * the row saved as 35202-1234567-1.
 *
 * Deliberately does not merge anything. Where two rows normalise to the same
 * identifier they are reported and left alone: merging profiles moves bookings
 * and scanned identity documents between people, which is destructive and is a
 * judgement about whether two records really are one human. That decision
 * belongs to someone who can look at both.
 *
 * Safe to re-run: a row already in canonical form is skipped.
 *
 *   netlify dev:exec npm run backfill:identifiers
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/* Duplicated from src/lib/guests.ts rather than imported: the seed tsconfig
   compiles this file outside the Next.js path aliases. Keep the two in step —
   the tests in tests/unit/guestIdentifiers.test.ts cover the real one. */
function normalizeCnic(cnic?: string | null): string | null {
  const raw = cnic?.trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 13) return raw
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

function normalizePassport(passport?: string | null): string | null {
  const raw = passport?.trim()
  if (!raw) return null
  return raw.replace(/[\s-]/g, '').toUpperCase() || null
}

async function backfill() {
  console.log('🔄 Rewriting guest CNIC and passport numbers into canonical form...')

  const guests = await prisma.guest.findMany({
    select: { id: true, name: true, cnic: true, passportNumber: true },
    orderBy: { createdAt: 'asc' },
  })

  let rewritten = 0
  let unchanged = 0
  const collisions: string[] = []

  for (const g of guests) {
    const cnic = normalizeCnic(g.cnic)
    const passport = normalizePassport(g.passportNumber)

    const data: { cnic?: string | null; passportNumber?: string | null } = {}
    if (cnic !== g.cnic) data.cnic = cnic
    if (passport !== g.passportNumber) data.passportNumber = passport

    if (Object.keys(data).length === 0) { unchanged++; continue }

    try {
      await prisma.guest.update({ where: { id: g.id }, data })
      rewritten++
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error

      // Someone already holds the canonical value: these two rows are the same
      // person recorded twice. Report both so a human can decide.
      const holder = await prisma.guest.findFirst({
        where: {
          OR: [
            ...(data.cnic ? [{ cnic: data.cnic }] : []),
            ...(data.passportNumber ? [{ passportNumber: data.passportNumber }] : []),
          ],
        },
        select: { id: true, name: true, cnic: true, passportNumber: true },
      })
      collisions.push(
        `   • "${g.name}" (${g.id}) holds ${g.cnic ?? g.passportNumber}, ` +
        `which is the same as "${holder?.name}" (${holder?.id})`,
      )
    }
  }

  console.log('✅ Done:')
  console.log(`   • ${rewritten} guest(s) rewritten`)
  console.log(`   • ${unchanged} already canonical`)

  if (collisions.length > 0) {
    console.log(`\n⚠️  ${collisions.length} duplicate profile(s) found, none merged:`)
    collisions.forEach(line => console.log(line))
    console.log('\n   Open both, move anything worth keeping onto the one to keep,')
    console.log('   then delete the other. Bookings survive a deleted profile —')
    console.log('   they keep their own guestName and CNIC columns.')
  }
}

backfill()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
