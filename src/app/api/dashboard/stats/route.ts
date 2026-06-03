import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'
import { startOfMonth, endOfMonth, subMonths, getDaysInMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    const [
      currentIncome,
      lastMonthIncome,
      currentExpenses,
      lastMonthExpenses,
      totalBookings,
      activeBookings,
      pendingBookings,
      propertiesCount,
      monthlyRevenue,
      bookingsByPlatform,
      recentBookings,
    ] = await Promise.all([
      prisma.income.aggregate({
        _sum: { netAmount: true },
        where: { receivedAt: { gte: thisMonthStart, lte: thisMonthEnd } },
      }),
      prisma.income.aggregate({
        _sum: { netAmount: true },
        where: { receivedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { date: { gte: thisMonthStart, lte: thisMonthEnd } },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { date: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } } }),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.property.count({ where: { status: 'ACTIVE' } }),
      // Monthly revenue for last 6 months
      prisma.income.groupBy({
        by: ['year', 'month'],
        _sum: { netAmount: true, grossAmount: true },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
        take: 6,
      }),
      prisma.booking.groupBy({
        by: ['platform'],
        _count: { id: true },
        _sum: { netAmount: true },
      }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { property: { select: { name: true } } },
      }),
    ])

    const currentRevenue = currentIncome._sum.netAmount || 0
    const lastRevenue = lastMonthIncome._sum.netAmount || 0
    const currentExp = currentExpenses._sum.amount || 0
    const lastExp = lastMonthExpenses._sum.amount || 0

    const revenueGrowth = lastRevenue === 0 ? 100 : Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 100)
    const expenseGrowth = lastExp === 0 ? 0 : Math.round(((currentExp - lastExp) / lastExp) * 100)

    // Occupancy calculation for current month
    const totalNightsAvailable = propertiesCount * getDaysInMonth(now)
    const bookedNightsThisMonth = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkIn: { lte: thisMonthEnd },
        checkOut: { gte: thisMonthStart },
      },
      select: { checkIn: true, checkOut: true, nights: true },
    })

    const bookedNights = bookedNightsThisMonth.reduce((acc, b) => {
      const checkIn = b.checkIn > thisMonthStart ? b.checkIn : thisMonthStart
      const checkOut = b.checkOut < thisMonthEnd ? b.checkOut : thisMonthEnd
      const nights = Math.max(0, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)))
      return acc + nights
    }, 0)

    const occupancyRate = totalNightsAvailable > 0 ? Math.round((bookedNights / totalNightsAvailable) * 100) : 0

    // Expense data by month for last 6 months
    const expensesByMonth = await prisma.expense.groupBy({
      by: ['year', 'month'],
      _sum: { amount: true },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      take: 6,
    })

    return apiResponse({
      stats: {
        totalRevenue: currentRevenue,
        totalExpenses: currentExp,
        netIncome: currentRevenue - currentExp,
        occupancyRate,
        totalBookings,
        activeBookings,
        pendingBookings,
        totalProperties: propertiesCount,
        revenueGrowth,
        expenseGrowth,
        bookedNights,
      },
      monthlyRevenue: monthlyRevenue.map((m) => ({
        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
        revenue: m._sum.netAmount || 0,
        gross: m._sum.grossAmount || 0,
      })),
      expensesByMonth: expensesByMonth.map((e) => ({
        month: `${e.year}-${String(e.month).padStart(2, '0')}`,
        expenses: e._sum.amount || 0,
      })),
      bookingsByPlatform,
      recentBookings,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    console.error('Dashboard stats error:', error)
    return apiError('Internal server error', 500)
  }
}
