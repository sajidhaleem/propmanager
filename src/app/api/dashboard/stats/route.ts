import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError, getMonthlyExpenseTotal } from '@/lib/utils'
import { startOfMonth, endOfMonth, subMonths, getDaysInMonth, startOfDay, addDays } from 'date-fns'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd   = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd   = endOfMonth(subMonths(now, 1))
    // For last-6-months chart: start of the month 5 months ago
    const sixMonthsAgoStart = startOfMonth(subMonths(now, 5))

    const [
      currentIncome,
      lastMonthIncome,
      currentExpenses,
      lastMonthExpenses,
      currentPayouts,
      lastMonthPayouts,
      totalBookings,
      activeBookings,
      pendingBookings,
      propertiesCount,
      monthlyRevenue,
      bookingsByPlatform,
      upcomingBookings,
      outstandingAggregate,
    ] = await Promise.all([
      // Revenue — recognized Income, created only when a booking is marked
      // CHECKED_OUT (see PATCH /api/bookings/[id]). Same basis as the Revenue
      // Overview chart below, so a booking that's paid but hasn't checked out
      // yet doesn't count until it does.
      prisma.income.aggregate({
        _sum: { netAmount: true },
        where: { month: thisMonthStart.getMonth() + 1, year: thisMonthStart.getFullYear() },
      }),
      prisma.income.aggregate({
        _sum: { netAmount: true },
        where: { month: lastMonthStart.getMonth() + 1, year: lastMonthStart.getFullYear() },
      }),
      // Expenses (operational costs) — cash basis: actual paidAmount, not the
      // full logged amount/liability.
      prisma.expense.aggregate({
        _sum: { paidAmount: true },
        where: { date: { gte: thisMonthStart, lte: thisMonthEnd } },
      }),
      prisma.expense.aggregate({
        _sum: { paidAmount: true },
        where: { date: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      // Payouts — cash basis: sum actual paidAmount regardless of status, so a
      // partially-paid PENDING payout counts its real paid portion, and a PAID
      // payout doesn't over-count if paidAmount hasn't caught up to amount.
      prisma.payout.aggregate({
        _sum: { paidAmount: true },
        where: { date: { gte: thisMonthStart, lte: thisMonthEnd } },
      }),
      prisma.payout.aggregate({
        _sum: { paidAmount: true },
        where: { date: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } } }),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.property.count({ where: { status: 'ACTIVE' } }),
      // Last 6 months of revenue — filter by date range so ordering is correct
      prisma.income.groupBy({
        by: ['year', 'month'],
        _sum: { netAmount: true, grossAmount: true },
        where: { receivedAt: { gte: sixMonthsAgoStart } },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      prisma.booking.groupBy({
        by: ['platform'],
        _count: { id: true },
        _sum: { netAmount: true },
        where: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      }),
      // Check-ins / check-outs happening today or tomorrow
      prisma.booking.findMany({
        where: {
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          OR: [
            { checkIn:  { gte: startOfDay(now), lt: addDays(startOfDay(now), 2) } },
            { checkOut: { gte: startOfDay(now), lt: addDays(startOfDay(now), 2) } },
          ],
        },
        include: { property: { select: { name: true } } },
        orderBy: { checkIn: 'asc' },
      }),
      prisma.booking.aggregate({
        _sum: { totalAmount: true, paidAmount: true },
        where: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      }),
    ])

    const currentRevenue  = currentIncome._sum.netAmount  || 0
    const lastRevenue     = lastMonthIncome._sum.netAmount || 0
    const currentExp      = (currentExpenses._sum.paidAmount || 0) + (currentPayouts._sum.paidAmount || 0)
    const lastExp         = (lastMonthExpenses._sum.paidAmount || 0) + (lastMonthPayouts._sum.paidAmount || 0)

    const revenueGrowth = lastRevenue === 0
      ? (currentRevenue === 0 ? 0 : 100)
      : Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 100)
    const expenseGrowth = lastExp === 0 ? 0   : Math.round(((currentExp - lastExp) / lastExp) * 100)

    // Occupancy calculation for current month
    const totalNightsAvailable = propertiesCount * getDaysInMonth(now)
    const bookedNightsThisMonth = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkIn:  { lte: thisMonthEnd },
        checkOut: { gte: thisMonthStart },
      },
      select: { checkIn: true, checkOut: true },
    })

    const bookedNights = bookedNightsThisMonth.reduce((acc, b) => {
      const start  = b.checkIn  > thisMonthStart ? b.checkIn  : thisMonthStart
      const end    = b.checkOut < thisMonthEnd   ? b.checkOut : thisMonthEnd
      const nights = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      return acc + nights
    }, 0)

    const occupancyRate = totalNightsAvailable > 0
      ? Math.round((bookedNights / totalNightsAvailable) * 100)
      : 0

    // Last 6 months of expenses + payouts combined for chart — cash basis
    const [expensesByMonthRaw, payoutsByMonthRaw] = await Promise.all([
      prisma.expense.groupBy({
        by: ['year', 'month'],
        _sum: { paidAmount: true },
        where: { date: { gte: sixMonthsAgoStart } },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      prisma.payout.groupBy({
        by: ['year', 'month'],
        _sum: { paidAmount: true },
        where: { date: { gte: sixMonthsAgoStart } },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
    ])

    // Merge expenses + payouts per month for chart
    const allMonthKeys = new Set([
      ...expensesByMonthRaw.map(e => `${e.year}-${e.month}`),
      ...payoutsByMonthRaw.map(p => `${p.year}-${p.month}`),
    ])
    const expensesByMonth = Array.from(allMonthKeys).sort().map(key => {
      const [y, m] = key.split('-').map(Number)
      const { total } = getMonthlyExpenseTotal(expensesByMonthRaw, payoutsByMonthRaw, y, m)
      return {
        month: `${y}-${String(m).padStart(2, '0')}`,
        expenses: total,
      }
    })

    const totalOutstanding =
      (outstandingAggregate._sum.totalAmount || 0) -
      (outstandingAggregate._sum.paidAmount  || 0)

    return apiResponse({
      stats: {
        totalRevenue:    currentRevenue,
        totalExpenses:   currentExp,
        netIncome:       currentRevenue - currentExp,
        occupancyRate,
        totalBookings,
        activeBookings,
        pendingBookings,
        totalProperties: propertiesCount,
        revenueGrowth,
        expenseGrowth,
        bookedNights,
        outstandingAmount: Math.max(0, totalOutstanding),
      },
      monthlyRevenue: monthlyRevenue.map((m) => ({
        month:   `${m.year}-${String(m.month).padStart(2, '0')}`,
        revenue: m._sum.netAmount   || 0,
        gross:   m._sum.grossAmount || 0,
      })),
      expensesByMonth,
      bookingsByPlatform,
      upcomingBookings,
    })
  } catch (error: any) {
    console.error('Dashboard stats error:', error)
    return handleApiError(error)
  }
}
