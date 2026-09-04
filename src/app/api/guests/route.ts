import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissionGuard'
import { guestSchema, blankToNull } from '@/lib/guests'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'guests')
    const search = req.nextUrl.searchParams.get('search')?.trim()
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200)

    const guests = await prisma.guest.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { cnic: { contains: search } },
              { phone: { contains: search } },
              { passportNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { _count: { select: { bookings: true } } },
      orderBy: { name: 'asc' },
      take: limit,
    })
    return apiResponse(guests)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'guests')
    const parsed = guestSchema.safeParse(await req.json())
    if (!parsed.success) return apiError(parsed.error.errors[0].message)

    const guest = await prisma.guest.create({ data: blankToNull(parsed.data) as never })
    return apiResponse(guest)
  } catch (error) {
    // A repeat guest is the normal case, not an error — point the caller at the
    // profile that already holds this CNIC or passport instead of failing blankly.
    if ((error as { code?: string }).code === 'P2002') {
      return apiError('A guest with this CNIC or passport already exists', 409)
    }
    return handleApiError(error)
  }
}
