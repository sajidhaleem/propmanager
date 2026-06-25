import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { addDays, subDays } from 'date-fns'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-clear-secret')
  if (secret !== process.env.CLEAR_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()

  // Properties
  const props = [
    { id: 'room-1', name: 'Room 1 - Deluxe', description: 'Comfortable deluxe room with en-suite bathroom', type: 'room', capacity: 2, baseRate: 75, status: 'ACTIVE', amenities: ['WiFi', 'AC', 'TV', 'En-suite Bathroom'] },
    { id: 'room-2', name: 'Room 2 - Standard', description: 'Standard room with shared facilities', type: 'room', capacity: 2, baseRate: 60, status: 'ACTIVE', amenities: ['WiFi', 'AC', 'TV'] },
    { id: 'room-3', name: 'Room 3 - Economy', description: 'Affordable economy room', type: 'room', capacity: 2, baseRate: 50, status: 'ACTIVE', amenities: ['WiFi', 'Fan', 'TV'] },
    { id: 'room-4', name: 'Room 4 - Suite', description: 'Premium suite with living area', type: 'suite', capacity: 4, baseRate: 120, status: 'ACTIVE', amenities: ['WiFi', 'AC', 'TV', 'Living Area', 'Mini Kitchen'] },
  ]
  for (const p of props) {
    await prisma.property.upsert({ where: { id: p.id }, update: {}, create: p as any })
  }

  // Users
  await prisma.user.upsert({
    where: { email: 'manager@propmanager.com' },
    update: {},
    create: { email: 'manager@propmanager.com', name: 'Property Manager', password: await bcrypt.hash('manager123', 12), role: 'MANAGER' },
  })
  await prisma.user.upsert({
    where: { email: 'staff@propmanager.com' },
    update: {},
    create: { email: 'staff@propmanager.com', name: 'Staff Member', password: await bcrypt.hash('staff123', 12), role: 'STAFF' },
  })

  // Bookings
  const bookingData = [
    { guestName: 'Ahmed Hassan', guestEmail: 'ahmed@example.com', checkIn: subDays(today, 45), nights: 3, rate: 75, platform: 'AIRBNB', status: 'CHECKED_OUT', propertyId: 'room-1' },
    { guestName: 'Sarah Johnson', guestEmail: 'sarah@example.com', checkIn: subDays(today, 40), nights: 5, rate: 60, platform: 'AIRBNB', status: 'CHECKED_OUT', propertyId: 'room-2' },
    { guestName: 'Mohammed Ali', guestEmail: 'moh@example.com', checkIn: subDays(today, 35), nights: 2, rate: 50, platform: 'DIRECT', status: 'CHECKED_OUT', propertyId: 'room-3' },
    { guestName: 'Emily Chen', guestEmail: 'emily@example.com', checkIn: subDays(today, 30), nights: 7, rate: 120, platform: 'AIRBNB', status: 'CHECKED_OUT', propertyId: 'room-4' },
    { guestName: 'David Wilson', guestEmail: 'david@example.com', checkIn: subDays(today, 25), nights: 4, rate: 75, platform: 'BOOKING_COM', status: 'CHECKED_OUT', propertyId: 'room-1' },
    { guestName: 'Fatima Al-Rashid', guestEmail: 'fatima@example.com', checkIn: subDays(today, 20), nights: 3, rate: 60, platform: 'AIRBNB', status: 'CHECKED_OUT', propertyId: 'room-2' },
    { guestName: 'James Brown', guestEmail: 'james@example.com', checkIn: subDays(today, 15), nights: 6, rate: 50, platform: 'AIRBNB', status: 'CHECKED_OUT', propertyId: 'room-3' },
    { guestName: 'Lina Müller', guestEmail: 'lina@example.com', checkIn: subDays(today, 10), nights: 2, rate: 120, platform: 'DIRECT', status: 'CHECKED_OUT', propertyId: 'room-4' },
    { guestName: 'Omar Khalid', guestEmail: 'omar@example.com', checkIn: subDays(today, 2), nights: 5, rate: 75, platform: 'AIRBNB', status: 'CHECKED_IN', propertyId: 'room-1' },
    { guestName: 'Priya Sharma', guestEmail: 'priya@example.com', checkIn: addDays(today, 2), nights: 4, rate: 60, platform: 'AIRBNB', status: 'CONFIRMED', propertyId: 'room-2' },
    { guestName: 'Carlos Rivera', guestEmail: 'carlos@example.com', checkIn: addDays(today, 5), nights: 3, rate: 120, platform: 'BOOKING_COM', status: 'CONFIRMED', propertyId: 'room-4' },
    { guestName: 'Amara Diallo', guestEmail: 'amara@example.com', checkIn: addDays(today, 10), nights: 7, rate: 75, platform: 'AIRBNB', status: 'CONFIRMED', propertyId: 'room-1' },
    { guestName: 'Sophie Martin', guestEmail: 'sophie@example.com', checkIn: addDays(today, 15), nights: 2, rate: 50, platform: 'DIRECT', status: 'PENDING', propertyId: 'room-3' },
    { guestName: 'Tariq Hussain', guestEmail: 'tariq@example.com', checkIn: addDays(today, 20), nights: 5, rate: 60, platform: 'VRBO', status: 'CONFIRMED', propertyId: 'room-2' },
  ]

  for (const b of bookingData) {
    const existing = await prisma.booking.findFirst({ where: { guestName: b.guestName, checkIn: b.checkIn } })
    if (existing) continue
    const checkOut = addDays(b.checkIn, b.nights)
    const cleaningFee = 15
    const platformFee = b.platform === 'DIRECT' ? 0 : b.rate * b.nights * 0.03
    const totalAmount = b.rate * b.nights + cleaningFee
    const netAmount = totalAmount - platformFee
    const booking = await prisma.booking.create({
      data: { guestName: b.guestName, guestEmail: b.guestEmail, checkIn: b.checkIn, checkOut, nights: b.nights, rate: b.rate, cleaningFee, platformFee, totalAmount, netAmount, platform: b.platform as any, status: b.status as any, propertyId: b.propertyId },
    })
    if (b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN') {
      await prisma.income.create({
        data: { bookingId: booking.id, grossAmount: totalAmount, platformFee, cleaningFee, netAmount, receivedAt: b.status === 'CHECKED_OUT' ? addDays(b.checkIn, b.nights) : today, month: b.checkIn.getMonth() + 1, year: b.checkIn.getFullYear() },
      })
    }
  }

  // Expenses
  const expenses = [
    { date: subDays(today, 50), category: 'CLEANING', description: 'Deep cleaning service', amount: 150, vendor: 'CleanPro Services' },
    { date: subDays(today, 45), category: 'UTILITIES', description: 'Electricity bill', amount: 280, vendor: 'Power Co.' },
    { date: subDays(today, 42), category: 'SUPPLIES', description: 'Toiletries and linens', amount: 95, vendor: 'HomeDepot' },
    { date: subDays(today, 38), category: 'MAINTENANCE', description: 'AC repair Room 2', amount: 200, vendor: 'Cool Air Services' },
    { date: subDays(today, 35), category: 'UTILITIES', description: 'Water bill', amount: 90, vendor: 'City Water' },
    { date: subDays(today, 30), category: 'CLEANING', description: 'Regular cleaning service', amount: 120, vendor: 'CleanPro Services' },
    { date: subDays(today, 28), category: 'PLATFORM_FEES', description: 'Airbnb host fee', amount: 45, vendor: 'Airbnb' },
    { date: subDays(today, 25), category: 'SUPPLIES', description: 'Kitchen supplies', amount: 75, vendor: 'IKEA' },
    { date: subDays(today, 20), category: 'REPAIRS', description: 'Plumbing repair Room 1', amount: 180, vendor: 'Fix-It Plumbing' },
    { date: subDays(today, 15), category: 'MARKETING', description: 'Photography session', amount: 250, vendor: 'Studio Snap' },
    { date: subDays(today, 10), category: 'INSURANCE', description: 'Property insurance premium', amount: 320, vendor: 'SecureHome Insurance' },
    { date: subDays(today, 7), category: 'CLEANING', description: 'Post-checkout cleaning', amount: 80, vendor: 'CleanPro Services' },
    { date: subDays(today, 5), category: 'UTILITIES', description: 'Internet bill', amount: 65, vendor: 'FastNet ISP' },
    { date: subDays(today, 3), category: 'SUPPLIES', description: 'Guest amenities restock', amount: 110, vendor: 'Amazon' },
  ]
  for (const e of expenses) {
    const exists = await prisma.expense.findFirst({ where: { description: e.description, date: e.date } })
    if (exists) continue
    await prisma.expense.create({ data: { ...e, category: e.category as any, month: e.date.getMonth() + 1, year: e.date.getFullYear() } })
  }

  // Payouts
  const payouts = [
    { recipientName: 'Shahid Ahmed', amount: 800, date: subDays(today, 30), type: 'SALARY', description: 'Monthly salary - property maintenance', status: 'PAID' },
    { recipientName: 'Shahid Ahmed', amount: 800, date: subDays(today, 60), type: 'SALARY', description: 'Monthly salary - property maintenance', status: 'PAID' },
    { recipientName: 'Cleaning Staff', amount: 350, date: subDays(today, 25), type: 'CLEANING_FEE', description: 'Cleaning services payment', status: 'PAID' },
    { recipientName: 'Cleaning Staff', amount: 280, date: subDays(today, 55), type: 'CLEANING_FEE', description: 'Cleaning services payment', status: 'PAID' },
    { recipientName: 'Shahid Ahmed', amount: 150, date: subDays(today, 10), type: 'BONUS', description: 'Performance bonus', status: 'PAID' },
    { recipientName: 'Shahid Ahmed', amount: 800, date: addDays(today, 5), type: 'SALARY', description: 'Monthly salary - property maintenance', status: 'PENDING' },
    { recipientName: 'Maintenance Team', amount: 200, date: subDays(today, 8), type: 'REIMBURSEMENT', description: 'Materials reimbursement', status: 'PAID' },
  ]
  for (const p of payouts) {
    const exists = await prisma.payout.findFirst({ where: { recipientName: p.recipientName, date: p.date, amount: p.amount } })
    if (exists) continue
    await prisma.payout.create({ data: { ...p, type: p.type as any, status: p.status as any, month: p.date.getMonth() + 1, year: p.date.getFullYear() } })
  }

  return NextResponse.json({ ok: true, message: 'Database seeded' })
}
