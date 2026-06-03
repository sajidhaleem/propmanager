import { PrismaClient, Role, Platform, BookingStatus, ExpenseCategory, PayoutType, PayoutStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addDays, subDays, startOfMonth, format } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Users
  const hashedPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@propmanager.com' },
    update: {},
    create: {
      email: 'admin@propmanager.com',
      name: 'Admin User',
      password: hashedPassword,
      role: Role.ADMIN,
    },
  })

  await prisma.user.upsert({
    where: { email: 'manager@propmanager.com' },
    update: {},
    create: {
      email: 'manager@propmanager.com',
      name: 'Property Manager',
      password: await bcrypt.hash('manager123', 12),
      role: Role.MANAGER,
    },
  })

  await prisma.user.upsert({
    where: { email: 'staff@propmanager.com' },
    update: {},
    create: {
      email: 'staff@propmanager.com',
      name: 'Staff Member',
      password: await bcrypt.hash('staff123', 12),
      role: Role.STAFF,
    },
  })

  // Properties (4 rooms from the spreadsheet)
  const properties = await Promise.all([
    prisma.property.upsert({
      where: { id: 'room-1' },
      update: {},
      create: {
        id: 'room-1',
        name: 'Room 1 - Deluxe',
        description: 'Comfortable deluxe room with en-suite bathroom',
        type: 'room',
        capacity: 2,
        baseRate: 75,
        status: 'ACTIVE',
        amenities: ['WiFi', 'AC', 'TV', 'En-suite Bathroom'],
      },
    }),
    prisma.property.upsert({
      where: { id: 'room-2' },
      update: {},
      create: {
        id: 'room-2',
        name: 'Room 2 - Standard',
        description: 'Standard room with shared facilities',
        type: 'room',
        capacity: 2,
        baseRate: 60,
        status: 'ACTIVE',
        amenities: ['WiFi', 'AC', 'TV'],
      },
    }),
    prisma.property.upsert({
      where: { id: 'room-3' },
      update: {},
      create: {
        id: 'room-3',
        name: 'Room 3 - Economy',
        description: 'Affordable economy room',
        type: 'room',
        capacity: 2,
        baseRate: 50,
        status: 'ACTIVE',
        amenities: ['WiFi', 'Fan', 'TV'],
      },
    }),
    prisma.property.upsert({
      where: { id: 'room-4' },
      update: {},
      create: {
        id: 'room-4',
        name: 'Room 4 - Suite',
        description: 'Premium suite with living area',
        type: 'suite',
        capacity: 4,
        baseRate: 120,
        status: 'ACTIVE',
        amenities: ['WiFi', 'AC', 'TV', 'Living Area', 'Mini Kitchen'],
      },
    }),
  ])

  const today = new Date()
  const bookingData = [
    // Past bookings
    { guestName: 'Ahmed Hassan', guestEmail: 'ahmed@example.com', checkIn: subDays(today, 45), nights: 3, rate: 75, platform: Platform.AIRBNB, status: BookingStatus.CHECKED_OUT, propertyId: 'room-1' },
    { guestName: 'Sarah Johnson', guestEmail: 'sarah@example.com', checkIn: subDays(today, 40), nights: 5, rate: 60, platform: Platform.AIRBNB, status: BookingStatus.CHECKED_OUT, propertyId: 'room-2' },
    { guestName: 'Mohammed Ali', guestEmail: 'moh@example.com', checkIn: subDays(today, 35), nights: 2, rate: 50, platform: Platform.DIRECT, status: BookingStatus.CHECKED_OUT, propertyId: 'room-3' },
    { guestName: 'Emily Chen', guestEmail: 'emily@example.com', checkIn: subDays(today, 30), nights: 7, rate: 120, platform: Platform.AIRBNB, status: BookingStatus.CHECKED_OUT, propertyId: 'room-4' },
    { guestName: 'David Wilson', guestEmail: 'david@example.com', checkIn: subDays(today, 25), nights: 4, rate: 75, platform: Platform.BOOKING_COM, status: BookingStatus.CHECKED_OUT, propertyId: 'room-1' },
    { guestName: 'Fatima Al-Rashid', guestEmail: 'fatima@example.com', checkIn: subDays(today, 20), nights: 3, rate: 60, platform: Platform.AIRBNB, status: BookingStatus.CHECKED_OUT, propertyId: 'room-2' },
    { guestName: 'James Brown', guestEmail: 'james@example.com', checkIn: subDays(today, 15), nights: 6, rate: 50, platform: Platform.AIRBNB, status: BookingStatus.CHECKED_OUT, propertyId: 'room-3' },
    { guestName: 'Lina Müller', guestEmail: 'lina@example.com', checkIn: subDays(today, 10), nights: 2, rate: 120, platform: Platform.DIRECT, status: BookingStatus.CHECKED_OUT, propertyId: 'room-4' },
    // Current / upcoming
    { guestName: 'Omar Khalid', guestEmail: 'omar@example.com', checkIn: subDays(today, 2), nights: 5, rate: 75, platform: Platform.AIRBNB, status: BookingStatus.CHECKED_IN, propertyId: 'room-1' },
    { guestName: 'Priya Sharma', guestEmail: 'priya@example.com', checkIn: addDays(today, 2), nights: 4, rate: 60, platform: Platform.AIRBNB, status: BookingStatus.CONFIRMED, propertyId: 'room-2' },
    { guestName: 'Carlos Rivera', guestEmail: 'carlos@example.com', checkIn: addDays(today, 5), nights: 3, rate: 120, platform: Platform.BOOKING_COM, status: BookingStatus.CONFIRMED, propertyId: 'room-4' },
    { guestName: 'Amara Diallo', guestEmail: 'amara@example.com', checkIn: addDays(today, 10), nights: 7, rate: 75, platform: Platform.AIRBNB, status: BookingStatus.CONFIRMED, propertyId: 'room-1' },
    { guestName: 'Sophie Martin', guestEmail: 'sophie@example.com', checkIn: addDays(today, 15), nights: 2, rate: 50, platform: Platform.DIRECT, status: BookingStatus.PENDING, propertyId: 'room-3' },
    { guestName: 'Tariq Hussain', guestEmail: 'tariq@example.com', checkIn: addDays(today, 20), nights: 5, rate: 60, platform: Platform.VRBO, status: BookingStatus.CONFIRMED, propertyId: 'room-2' },
  ]

  for (const b of bookingData) {
    const checkOut = addDays(b.checkIn, b.nights)
    const cleaningFee = 15
    const platformFee = b.platform === Platform.DIRECT ? 0 : b.rate * b.nights * 0.03
    const totalAmount = b.rate * b.nights + cleaningFee
    const netAmount = totalAmount - platformFee

    const existingBooking = await prisma.booking.findFirst({
      where: { guestName: b.guestName, checkIn: b.checkIn }
    })
    if (existingBooking) continue

    const booking = await prisma.booking.create({
      data: {
        guestName: b.guestName,
        guestEmail: b.guestEmail,
        checkIn: b.checkIn,
        checkOut,
        nights: b.nights,
        rate: b.rate,
        cleaningFee,
        platformFee,
        totalAmount,
        netAmount,
        platform: b.platform,
        status: b.status,
        propertyId: b.propertyId,
      },
    })

    if (b.status === BookingStatus.CHECKED_OUT || b.status === BookingStatus.CHECKED_IN) {
      await prisma.income.create({
        data: {
          bookingId: booking.id,
          grossAmount: totalAmount,
          platformFee,
          cleaningFee,
          netAmount,
          receivedAt: b.status === BookingStatus.CHECKED_OUT ? addDays(b.checkIn, b.nights) : today,
          month: b.checkIn.getMonth() + 1,
          year: b.checkIn.getFullYear(),
        },
      })
    }
  }

  // Expenses
  const expenseData = [
    { date: subDays(today, 50), category: ExpenseCategory.CLEANING, description: 'Deep cleaning service', amount: 150, vendor: 'CleanPro Services' },
    { date: subDays(today, 45), category: ExpenseCategory.UTILITIES, description: 'Electricity bill', amount: 280, vendor: 'Power Co.' },
    { date: subDays(today, 42), category: ExpenseCategory.SUPPLIES, description: 'Toiletries and linens', amount: 95, vendor: 'HomeDepot' },
    { date: subDays(today, 38), category: ExpenseCategory.MAINTENANCE, description: 'AC repair Room 2', amount: 200, vendor: 'Cool Air Services' },
    { date: subDays(today, 35), category: ExpenseCategory.UTILITIES, description: 'Water bill', amount: 90, vendor: 'City Water' },
    { date: subDays(today, 30), category: ExpenseCategory.CLEANING, description: 'Regular cleaning service', amount: 120, vendor: 'CleanPro Services' },
    { date: subDays(today, 28), category: ExpenseCategory.PLATFORM_FEES, description: 'Airbnb host fee', amount: 45, vendor: 'Airbnb' },
    { date: subDays(today, 25), category: ExpenseCategory.SUPPLIES, description: 'Kitchen supplies', amount: 75, vendor: 'IKEA' },
    { date: subDays(today, 20), category: ExpenseCategory.REPAIRS, description: 'Plumbing repair Room 1', amount: 180, vendor: 'Fix-It Plumbing' },
    { date: subDays(today, 15), category: ExpenseCategory.MARKETING, description: 'Photography session', amount: 250, vendor: 'Studio Snap' },
    { date: subDays(today, 10), category: ExpenseCategory.INSURANCE, description: 'Property insurance premium', amount: 320, vendor: 'SecureHome Insurance' },
    { date: subDays(today, 7), category: ExpenseCategory.CLEANING, description: 'Post-checkout cleaning', amount: 80, vendor: 'CleanPro Services' },
    { date: subDays(today, 5), category: ExpenseCategory.UTILITIES, description: 'Internet bill', amount: 65, vendor: 'FastNet ISP' },
    { date: subDays(today, 3), category: ExpenseCategory.SUPPLIES, description: 'Guest amenities restock', amount: 110, vendor: 'Amazon' },
  ]

  for (const e of expenseData) {
    const exists = await prisma.expense.findFirst({
      where: { description: e.description, date: e.date }
    })
    if (exists) continue
    await prisma.expense.create({
      data: {
        ...e,
        month: e.date.getMonth() + 1,
        year: e.date.getFullYear(),
      },
    })
  }

  // Payouts
  const payoutData = [
    { recipientName: 'Shahid Ahmed', amount: 800, date: subDays(today, 30), type: PayoutType.SALARY, description: 'Monthly salary - property maintenance', status: PayoutStatus.PAID },
    { recipientName: 'Shahid Ahmed', amount: 800, date: subDays(today, 60), type: PayoutType.SALARY, description: 'Monthly salary - property maintenance', status: PayoutStatus.PAID },
    { recipientName: 'Cleaning Staff', amount: 350, date: subDays(today, 25), type: PayoutType.CLEANING_FEE, description: 'Cleaning services payment', status: PayoutStatus.PAID },
    { recipientName: 'Cleaning Staff', amount: 280, date: subDays(today, 55), type: PayoutType.CLEANING_FEE, description: 'Cleaning services payment', status: PayoutStatus.PAID },
    { recipientName: 'Shahid Ahmed', amount: 150, date: subDays(today, 10), type: PayoutType.BONUS, description: 'Performance bonus', status: PayoutStatus.PAID },
    { recipientName: 'Shahid Ahmed', amount: 800, date: addDays(today, 5), type: PayoutType.SALARY, description: 'Monthly salary - property maintenance', status: PayoutStatus.PENDING },
    { recipientName: 'Maintenance Team', amount: 200, date: subDays(today, 8), type: PayoutType.REIMBURSEMENT, description: 'Materials reimbursement', status: PayoutStatus.PAID },
  ]

  for (const p of payoutData) {
    const exists = await prisma.payout.findFirst({
      where: { recipientName: p.recipientName, date: p.date, amount: p.amount }
    })
    if (exists) continue
    await prisma.payout.create({
      data: {
        ...p,
        month: p.date.getMonth() + 1,
        year: p.date.getFullYear(),
      },
    })
  }

  console.log('✅ Database seeded successfully!')
  console.log('')
  console.log('Default login credentials:')
  console.log('  Admin:   admin@propmanager.com    / admin123')
  console.log('  Manager: manager@propmanager.com  / manager123')
  console.log('  Staff:   staff@propmanager.com    / staff123')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
