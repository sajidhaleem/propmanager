/**
 * One-time backfill for the new Expense.paidAmount / Payout.paidAmount columns.
 * Historical rows predate partial-payment tracking and were, in practice,
 * already settled in full — so they're marked fully paid (paidAmount = amount).
 *
 * The `paidAmount = 0` guard makes this safe to re-run, but run it exactly
 * once, immediately after the schema change reaches the target database and
 * BEFORE any real expense/payout is entered through the new UI — otherwise a
 * genuinely unpaid new record (intentionally left at 0) could get overwritten.
 *
 * Run: npx ts-node --project tsconfig.seed.json scripts/backfill-paid-amount.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfill() {
  console.log('🔄 Backfilling paidAmount for existing Expense/Payout rows...')

  const expenses = await prisma.$executeRaw`UPDATE "Expense" SET "paidAmount" = "amount" WHERE "paidAmount" = 0`
  const payouts  = await prisma.$executeRaw`UPDATE "Payout"  SET "paidAmount" = "amount" WHERE "paidAmount" = 0`

  console.log(`✅ Updated:`)
  console.log(`   • ${expenses} expense row(s)`)
  console.log(`   • ${payouts} payout row(s)`)
  console.log('')
  console.log('ℹ️  Rows already at paidAmount > 0 (real 0-liability rows, if any, or already backfilled) were left untouched.')
}

backfill()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
