import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const type = searchParams.get('type') || 'monthly'

    if (type === 'monthly') {
      const [incomeByMonth, expensesByMonth, bookingsByMonth] = await Promise.all([
        prisma.income.groupBy({
          by: ['year', 'month'],
          _sum: { grossAmount: true, netAmount: true, platformFee: true },
          where: { year },
          orderBy: [{ month: 'asc' }],
        }),
        prisma.expense.groupBy({
          by: ['year', 'month'],
          _sum: { amount: true },
          where: { year },
          orderBy: [{ month: 'asc' }],
        }),
        prisma.booking.groupBy({
          by: ['status'],
          _count: { id: true },
          _sum: { nights: true, netAmount: true },
          where: {
            checkIn: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
          },
        }),
      ])

      const months = Array.from({ length: 12 }, (_, i) => i + 1)
      const merged = months.map((month) => {
        const income = incomeByMonth.find((m) => m.month === month)
        const expenses = expensesByMonth.find((m) => m.month === month)
        return {
          month,
          year,
          revenue: income?._sum.netAmount || 0,
          grossRevenue: income?._sum.grossAmount || 0,
          platformFees: income?._sum.platformFee || 0,
          expenses: expenses?._sum.amount || 0,
          net: (income?._sum.netAmount || 0) - (expenses?._sum.amount || 0),
        }
      })

      return apiResponse({ monthly: merged, bookingsByStatus: bookingsByMonth, year })
    }

    if (type === 'property') {
      const properties = await prisma.property.findMany({
        include: {
          bookings: {
            where: {
              checkIn: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
            select: { nights: true, netAmount: true, status: true },
          },
        },
      })

      const propertyStats = properties.map((p) => ({
        id: p.id,
        name: p.name,
        totalBookings: p.bookings.length,
        totalNights: p.bookings.reduce((sum, b) => sum + b.nights, 0),
        totalRevenue: p.bookings.reduce((sum, b) => sum + b.netAmount, 0),
        avgRate: p.bookings.length > 0
          ? p.bookings.reduce((sum, b) => sum + b.netAmount, 0) / p.bookings.reduce((sum, b) => sum + b.nights, 0)
          : 0,
      }))

      return apiResponse({ properties: propertyStats, year })
    }

    if (type === 'platform') {
      const platformStats = await prisma.booking.groupBy({
        by: ['platform'],
        _count: { id: true },
        _sum: { netAmount: true, nights: true },
        where: {
          checkIn: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      })
      return apiResponse({ platforms: platformStats, year })
    }

    return apiError('Invalid report type')
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    console.error('Reports error:', error)
    return apiError('Internal server error', 500)
  }
}
