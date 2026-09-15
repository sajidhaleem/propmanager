import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * A simplified room calendar for Sajid's Cockpit (cockpit-sajid.netlify.app):
 * which room is booked on which nights, and nothing more.
 *
 * Called server-to-server, so it cannot carry the auth-token cookie. Same
 * arrangement as the ledger feed: listed in middleware PUBLIC_PATHS, guarded here
 * by its own secret, and a wrong or missing secret returns 404 so the endpoint
 * does not announce itself.
 *
 * READ ONLY. A guest appears as a first name. No contact details, CNIC, passport
 * or money leave this app through here.
 */

const DAY = 24 * 60 * 60 * 1000
const MAX_SPAN = 120 * DAY

function authorised(req: NextRequest): boolean {
  const expected = process.env.COCKPIT_CALENDAR_SECRET
  // Unset or short turns the feed off rather than open.
  if (!expected || expected.length < 16) return false
  const given = Buffer.from(req.headers.get('x-cockpit-secret') || '', 'utf8')
  const want = Buffer.from(expected, 'utf8')
  return given.length === want.length && timingSafeEqual(given, want)
}

const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || 'Guest'

export async function GET(req: NextRequest) {
  if (!authorised(req)) return new NextResponse('Not found', { status: 404 })

  const { searchParams } = new URL(req.url)
  const from = new Date(searchParams.get('from') || Date.now() - 7 * DAY)
  const to = new Date(searchParams.get('to') || Date.now() + 35 * DAY)
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > MAX_SPAN) {
    return NextResponse.json({ error: 'Give a from and to no more than 120 days apart.' }, { status: 400 })
  }

  const [properties, bookings] = await Promise.all([
    prisma.property.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: 'asc' } }),
    prisma.booking.findMany({
      // Cancelled and no-show stays release the room, as on the calendar page.
      where: { checkIn: { lt: to }, checkOut: { gt: from }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      select: { id: true, propertyId: true, guestName: true, checkIn: true, checkOut: true, nights: true, status: true, platform: true },
      orderBy: { checkIn: 'asc' },
    }),
  ])

  return NextResponse.json({
    properties,
    bookings: bookings.map((b) => ({ ...b, guestName: firstName(b.guestName) })),
  })
}
