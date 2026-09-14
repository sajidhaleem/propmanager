import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissionGuard'
import { guestSchema, blankToNull, normalizeGuestIdentity, guestSearchVariants } from '@/lib/guests'
import { findExistingGuest } from '@/lib/guestLink'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'guests')
    const search = req.nextUrl.searchParams.get('search')?.trim()
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200)

    /* Search the way the number was typed and the way it is stored. A desk that
       types 3520212345671 must find the guest saved as 35202-1234567-1 —
       otherwise the search comes back empty and they create the duplicate the
       search existed to prevent. */
    const variants = guestSearchVariants(search)

    const guests = await prisma.guest.findMany({
      where: search
        ? {
            OR: variants.flatMap(term => [
              { name: { contains: term, mode: 'insensitive' as const } },
              { cnic: { contains: term } },
              { phone: { contains: term } },
              { passportNumber: { contains: term, mode: 'insensitive' as const } },
            ]),
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

    const data = normalizeGuestIdentity(blankToNull(parsed.data))

    /* Look before creating. The unique index would catch a repeat CNIC anyway,
       but only as a failed write with no way back to the profile that already
       exists — so the desk sees an error, types the name slightly differently,
       and the duplicate is created after all. */
    const existing = await findExistingGuest(data)
    if (existing) {
      return apiError(
        `${existing.name} is already on file with this ${existing.matchedOn}`,
        409,
      )
    }

    const guest = await prisma.guest.create({ data: data as never })
    return apiResponse(guest)
  } catch (error) {
    // Lost a race to another desk saving the same person — still not an error
    // worth showing as a failure, so name the person already on file.
    if ((error as { code?: string }).code === 'P2002') {
      return apiError('A guest with this CNIC or passport already exists', 409)
    }
    return handleApiError(error)
  }
}
