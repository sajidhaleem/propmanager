import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Machine-readable ledger feed, consumed by Hisaab (the personal finance app) so
 * guesthouse money shows up in the household books without being typed twice.
 *
 * Called by a scheduled job rather than a browser, so it cannot carry the
 * auth-token cookie. It is defended the same way /api/hotel-eye/poll is: listed in
 * middleware PUBLIC_PATHS, then guarded here by a shared secret. A wrong or missing
 * secret returns 404 rather than 401, so the endpoint does not announce itself to
 * anything scanning the site.
 *
 * This route is READ ONLY. It never writes, and it deliberately exposes no guest
 * identity beyond a display name — no CNIC, no passport, no address, no contact
 * details. Those fields exist on Booking and must never leave this app.
 */

const MAX_LIMIT = 1000

function authorised(req: NextRequest): boolean {
  const expected = process.env.LEDGER_SYNC_SECRET
  // Unset secret means the feature is off. Failing closed matters more here than
  // convenience: an unset env var must never mean "let everyone in".
  if (!expected || expected.length < 16) return false

  const given = req.headers.get('x-sync-secret') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  try {
    if (!authorised(req)) return apiError('Not found', 404)

    const { searchParams } = new URL(req.url)
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '500')))

    // `since` filters on when the money moved, not when the row was written, so a
    // backdated entry still comes through on the next pull.
    const sinceRaw = searchParams.get('since')
    const since = sinceRaw ? new Date(sinceRaw) : null
    if (sinceRaw && Number.isNaN(since!.getTime())) {
      return apiError('`since` must be an ISO date', 400)
    }
    const dateFilter = since ? { gte: since } : undefined

    const [income, expenses, payouts] = await Promise.all([
      prisma.income.findMany({
        where: dateFilter ? { receivedAt: dateFilter } : {},
        include: {
          booking: {
            select: {
              id: true,
              guestName: true,
              platform: true,
              status: true,
              checkIn: true,
              checkOut: true,
              totalAmount: true,
              paidAmount: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { receivedAt: 'asc' },
        take: limit,
      }),
      prisma.expense.findMany({
        where: dateFilter ? { date: dateFilter } : {},
        // receiptData is a base64 blob in a Text column — never ship it over the wire.
        select: {
          id: true,
          date: true,
          category: true,
          subcategory: true,
          description: true,
          amount: true,
          paidAmount: true,
          vendor: true,
          notes: true,
        },
        orderBy: { date: 'asc' },
        take: limit,
      }),
      prisma.payout.findMany({
        where: dateFilter ? { date: dateFilter } : {},
        select: {
          id: true,
          date: true,
          recipientName: true,
          type: true,
          amount: true,
          paidAmount: true,
          status: true,
          description: true,
        },
        orderBy: { date: 'asc' },
        take: limit,
      }),
    ])

    return apiResponse({
      generatedAt: new Date().toISOString(),
      since: since?.toISOString() ?? null,
      limit,
      /**
       * Amounts in this app are bare numbers — the currency selector is a
       * client-side display preference (useUIStore), not a column, so nothing here
       * is currency-tagged at the row level. This app is used in Pakistani rupees;
       * the consumer is expected to assert that rather than assume it silently.
       */
      currency: 'PKR',
      income: income.map((i) => ({
        id: i.id,
        bookingId: i.bookingId,
        guestName: i.booking.guestName,
        platform: i.booking.platform,
        bookingStatus: i.booking.status,
        propertyId: i.booking.property.id,
        propertyName: i.booking.property.name,
        checkIn: i.booking.checkIn.toISOString(),
        checkOut: i.booking.checkOut.toISOString(),
        receivedAt: i.receivedAt.toISOString(),
        grossAmount: i.grossAmount,
        platformFee: i.platformFee,
        // Charged TO the guest and already included in grossAmount — revenue, not
        // a cost. Sent for completeness; booking it as an expense would be wrong.
        cleaningFee: i.cleaningFee,
        netAmount: i.netAmount,
        // The cash-basis pair. An Income row is created the moment a booking is
        // marked CHECKED_OUT, whether or not the guest actually paid, so a consumer
        // that wants cash rather than accrual must read paidAmount.
        totalAmount: i.booking.totalAmount,
        paidAmount: i.booking.paidAmount,
      })),
      expenses,
      payouts,
      counts: { income: income.length, expenses: expenses.length, payouts: payouts.length },
      truncated:
        income.length === limit || expenses.length === limit || payouts.length === limit,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
