import type { BrowserContext } from '@playwright/test'

/**
 * Serves the app's read endpoints from fixtures.
 *
 * These specs assert on rendering and client-side logic — payment-status
 * derivation, room availability, insight grading — all of which need exact,
 * known inputs. Driving them from seed data would make an assertion like
 * "85% occupancy is graded Excellent" depend on whatever the seed happens to
 * contain that week.
 *
 * Registered on the BrowserContext, not the Page: page-level routes stop
 * applying after a cross-page navigation, which silently lets requests through
 * to the real server.
 */

const day = 86_400_000
const at = (offsetDays: number, hour: number) => {
  const d = new Date(Date.now() + offsetDays * day)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).toISOString()
}

export const PROPERTIES = [
  { id: 'p1', name: 'Room 1', baseRate: 5000, status: 'AVAILABLE' },
  { id: 'p2', name: 'Room 2', baseRate: 6000, status: 'AVAILABLE' },
  { id: 'p3', name: 'Room 3', baseRate: 7000, status: 'MAINTENANCE' },
]

const booking = (
  id: string, guestName: string, propertyId: string, propertyName: string,
  platform: string, status: string, paidAmount: number, offset: number, notes = ''
) => ({
  id, guestName, guestEmail: '', guestPhone: '',
  checkIn: at(offset, 14), checkOut: at(offset + 1, 12), nights: 1,
  rate: 10000, cleaningFee: 0, platformFee: 0,
  totalAmount: 10000, netAmount: 10000, paidAmount,
  platform, status, propertyId, property: { id: propertyId, name: propertyName },
  notes, hotelEyeStatus: 'NOT_ENTERED', miscCharges: 0,
})

/* Room 1 is occupied today, Room 2 is free today, Room 3 is under maintenance —
   which is what the calendar availability spec asserts against. */
export const BOOKINGS = [
  booking('b1', 'Fully Paid Guest',  'p1', 'Room 1', 'DIRECT', 'CHECKED_IN', 10000, 0),
  booking('b2', 'Half Paid Guest',   'p2', 'Room 2', 'AIRBNB', 'CONFIRMED',   4000, 5),
  /* Lifecycle status is deliberately CONFIRMED, not PENDING: the payment badge
     and the lifecycle selector would both read "Pending", making an assertion
     on that word ambiguous about which control it found. */
  booking('b3', 'Unpaid Guest',      'p2', 'Room 2', 'OTHER',  'CONFIRMED',      0, 7, '[Walk-in] cash on arrival'),
]

/* A month that lost money at high occupancy with nothing outstanding — the
   combination that the old hardcoded insight statuses graded as excellent. */
export const LOSS_MAKING_STATS = {
  stats: {
    totalRevenue: 106_499,
    totalExpenses: 165_626,
    netIncome: -59_127,
    occupancyRate: 85,
    totalBookings: 87,
    activeBookings: 6,
    pendingBookings: 1,
    totalProperties: 4,
    revenueGrowth: -6,
    expenseGrowth: 3,
    bookedNights: 106,
    outstandingAmount: 0,
  },
  monthlyRevenue: [],
  expensesByMonth: [],
  bookingsByPlatform: [
    { platform: 'DIRECT', _count: { id: 72 }, _sum: { netAmount: 900_000 } },
    { platform: 'AIRBNB', _count: { id: 4 },  _sum: { netAmount: 60_000 } },
  ],
  upcomingBookings: [],
}

export const paymentStatusOf = (b: { totalAmount: number; paidAmount: number }) =>
  b.paidAmount >= b.totalAmount ? 'PAID' : b.paidAmount > 0 ? 'PARTIAL' : 'PENDING'

export async function stubApi(
  context: BrowserContext,
  overrides: { stats?: unknown; bookings?: typeof BOOKINGS } = {}
) {
  const rows = overrides.bookings ?? BOOKINGS
  const stats = overrides.stats ?? LOSS_MAKING_STATS

  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const json = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

    if (path.startsWith('/api/bookings') && path.includes('/documents')) return json([])

    if (path === '/api/bookings') {
      // mirrors the server-side paymentStatus filter so the filter round-trip is exercised
      const want = url.searchParams.get('paymentStatus')
      const data = want ? rows.filter((b) => paymentStatusOf(b) === want) : rows
      return json({ data, total: data.length, page: 1, limit: 15, totalPages: 1 })
    }

    if (path === '/api/properties')      return json(PROPERTIES)
    if (path === '/api/dashboard/stats') return json(stats)

    /* Derived from the same fixture rows the list is served from, so the
       banner and the badges can never disagree in a test. */
    if (path === '/api/hotel-eye/compliance') {
      const isToday = (d: string) => {
        const x = new Date(d), n = new Date()
        return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate()
      }
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      const arrivals = rows.filter((b) => isToday(b.checkIn))
      return json({
        arrivalsToday: arrivals.length,
        filedToday: arrivals.filter((b) => b.hotelEyeStatus === 'ENTERED').length,
        overdue: rows.filter((b) => b.hotelEyeStatus !== 'ENTERED' && new Date(b.checkIn).getTime() < cutoff).length,
        failed: rows.filter((b) => b.hotelEyeStatus === 'FAILED').length,
        clear: false,
        windowHours: 24,
      })
    }
    if (path === '/api/settings')        return json(null) // falls back to DEFAULT_PLATFORMS
    return json(null)
  })
}

/** Waits for react-query data to replace the loading skeletons. */
export async function waitForData(page: import('@playwright/test').Page, marker: string) {
  await page.waitForFunction((m) => document.body.innerText.includes(m), marker, { timeout: 60_000 })
}
