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

    // ── P&L Report: Month | Airbnb Rev | Utilities | Cleaning | Repairs | Supplies | Internet | Other | Net Profit ──
    if (type === 'pnl') {
      const EXPENSE_CATS = ['UTILITIES', 'CLEANING', 'REPAIRS', 'SUPPLIES', 'MAINTENANCE', 'OTHER'] as const
      const dateStart = new Date(`${year}-01-01`)
      const dateEnd   = new Date(`${year}-12-31`)

      const [incomeRows, expenseRows] = await Promise.all([
        // Income by month (all platforms, but we track Airbnb separately)
        prisma.income.findMany({
          where: { year },
          include: { booking: { select: { platform: true } } },
        }),
        // Expenses by month + category
        prisma.expense.findMany({
          where: { year, date: { gte: dateStart, lte: dateEnd } },
          select: { month: true, category: true, amount: true },
        }),
      ])

      const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

      const pnl = MONTHS.map((month) => {
        const monthIncome = incomeRows.filter(r => r.month === month)
        const airbnbRevenue = monthIncome
          .filter(r => r.booking?.platform === 'AIRBNB')
          .reduce((s, r) => s + r.netAmount, 0)
        const otherRevenue = monthIncome
          .filter(r => r.booking?.platform !== 'AIRBNB')
          .reduce((s, r) => s + r.netAmount, 0)
        const totalRevenue = airbnbRevenue + otherRevenue

        const monthExpenses = expenseRows.filter(r => r.month === month)
        const byCategory: Record<string, number> = {}
        EXPENSE_CATS.forEach(cat => {
          byCategory[cat] = monthExpenses
            .filter(e => e.category === cat)
            .reduce((s, e) => s + e.amount, 0)
        })
        // Non-standard categories go into OTHER
        const trackedCats = EXPENSE_CATS as readonly string[]
        const extraOther = monthExpenses
          .filter(e => !trackedCats.includes(e.category))
          .reduce((s, e) => s + e.amount, 0)
        byCategory['OTHER'] = (byCategory['OTHER'] || 0) + extraOther

        const totalExpenses = Object.values(byCategory).reduce((s, v) => s + v, 0)
        const netProfit = totalRevenue - totalExpenses

        return {
          month,
          airbnbRevenue,
          otherRevenue,
          totalRevenue,
          ...byCategory,
          totalExpenses,
          netProfit,
        }
      })

      const totals: Record<string, number> = {
        month: 0,
        airbnbRevenue: pnl.reduce((s, r) => s + r.airbnbRevenue, 0),
        otherRevenue:  pnl.reduce((s, r) => s + r.otherRevenue, 0),
        totalRevenue:  pnl.reduce((s, r) => s + r.totalRevenue, 0),
        UTILITIES:     pnl.reduce((s, r: any) => s + (r.UTILITIES    || 0), 0),
        CLEANING:      pnl.reduce((s, r: any) => s + (r.CLEANING     || 0), 0),
        REPAIRS:       pnl.reduce((s, r: any) => s + (r.REPAIRS      || 0), 0),
        SUPPLIES:      pnl.reduce((s, r: any) => s + (r.SUPPLIES     || 0), 0),
        MAINTENANCE:   pnl.reduce((s, r: any) => s + (r.MAINTENANCE  || 0), 0),
        OTHER:         pnl.reduce((s, r: any) => s + (r.OTHER        || 0), 0),
        totalExpenses: pnl.reduce((s, r) => s + r.totalExpenses, 0),
        netProfit:     pnl.reduce((s, r) => s + r.netProfit, 0),
      }

      return apiResponse({ pnl, totals, year })
    }

    return apiError('Invalid report type')
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    console.error('Reports error:', error)
    return apiError('Internal server error', 500)
  }
}
