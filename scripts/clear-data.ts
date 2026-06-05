/**
 * Clears all test/demo data from the database.
 * Keeps users intact. Removes: bookings, income, expenses, payouts, audit logs.
 * Run: npx ts-node --project tsconfig.seed.json scripts/clear-data.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearData() {
  console.log('🗑️  Clearing all test data...')

  // Order matters due to foreign keys
  const income    = await prisma.income.deleteMany()
  const bookings  = await prisma.booking.deleteMany()
  const expenses  = await prisma.expense.deleteMany()
  const payouts   = await prisma.payout.deleteMany()
  const auditLogs = await prisma.auditLog.deleteMany()

  console.log(`✅ Removed:`)
  console.log(`   • ${income.count} income records`)
  console.log(`   • ${bookings.count} bookings`)
  console.log(`   • ${expenses.count} expenses`)
  console.log(`   • ${payouts.count} payouts`)
  console.log(`   • ${auditLogs.count} audit logs`)
  console.log('')
  console.log('ℹ️  Users were kept. The app is now clean and ready for real data.')
}

clearData()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
