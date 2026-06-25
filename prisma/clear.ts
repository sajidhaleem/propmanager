import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Clearing all data...')

  await prisma.income.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.payout.deleteMany()
  await prisma.property.deleteMany()

  // Remove dummy users, keep the real admin
  await prisma.user.deleteMany({
    where: { email: { in: ['manager@propmanager.com', 'staff@propmanager.com'] } }
  })

  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
