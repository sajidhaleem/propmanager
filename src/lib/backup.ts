import { prisma } from '@/lib/db'
import { format } from 'date-fns'

/* A snapshot embeds the whole database in one jsonb column — including the
   base64 of every scanned card and every receipt. One was written per day and
   nothing ever removed them, so the Backup table grew by the size of the entire
   database daily and dragged every other query down with it. Keep a week of
   recovery, drop the rest. */
export const KEEP_BACKUPS = 7

/* The day's slot, claimed before the snapshot rather than after it. */
export const AUTO_BACKUP_KEY = 'autoBackupDay'

export async function createBackup(label: string, createdBy?: string) {
  const [properties, bookings, income, expenses, payouts, documents] = await Promise.all([
    prisma.property.findMany(),
    prisma.booking.findMany(),
    prisma.income.findMany(),
    prisma.expense.findMany(),
    prisma.payout.findMany(),
    prisma.document.findMany(),
  ])

  const recordCount = properties.length + bookings.length + income.length + expenses.length + payouts.length + documents.length

  const backup = await prisma.backup.create({
    data: {
      label,
      recordCount,
      createdBy,
      data: { properties, bookings, income, expenses, payouts, documents },
    },
  })

  const stale = await prisma.backup.findMany({
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    skip: KEEP_BACKUPS,
  })
  if (stale.length > 0) {
    await prisma.backup.deleteMany({ where: { id: { in: stale.map((b) => b.id) } } })
  }

  return backup
}

export async function autoBackupIfNeeded(userEmail: string) {
  const today = format(new Date(), 'yyyy-MM-dd')

  const marker = await prisma.setting.findUnique({ where: { key: AUTO_BACKUP_KEY } })
  if (marker?.value === today) return

  /* Claim the day before doing the work. This runs fire-and-forget on a
     serverless login request, so a snapshot that gets frozen part-way through
     must not leave every later login starting another full-database read — that
     cost lands on the login itself, every time, and never produces a backup.
     Losing one day's snapshot to a frozen request is the cheaper failure. */
  await prisma.setting.upsert({
    where: { key: AUTO_BACKUP_KEY },
    update: { value: today },
    create: { key: AUTO_BACKUP_KEY, value: today },
  })

  await createBackup(`Auto — ${format(new Date(), 'MMM d, yyyy')}`, userEmail)
}
