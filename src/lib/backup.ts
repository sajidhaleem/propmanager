import { prisma } from '@/lib/db'
import { format } from 'date-fns'

export async function createBackup(label: string, createdBy?: string) {
  const [properties, bookings, income, expenses, payouts] = await Promise.all([
    prisma.property.findMany(),
    prisma.booking.findMany(),
    prisma.income.findMany(),
    prisma.expense.findMany(),
    prisma.payout.findMany(),
  ])

  const recordCount = properties.length + bookings.length + income.length + expenses.length + payouts.length

  return prisma.backup.create({
    data: {
      label,
      recordCount,
      createdBy,
      data: { properties, bookings, income, expenses, payouts },
    },
  })
}

export async function autoBackupIfNeeded(userEmail: string) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const exists = await prisma.backup.findFirst({ where: { createdAt: { gte: todayStart } } })
  if (!exists) {
    await createBackup(`Auto — ${format(new Date(), 'MMM d, yyyy')}`, userEmail)
  }
}
