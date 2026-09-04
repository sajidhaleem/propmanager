import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissionGuard'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'
import { guestSchema, blankToNull } from '@/lib/guests'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(req, 'guests')
    const { id } = await params
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        bookings: {
          select: {
            id: true, checkIn: true, checkOut: true, totalAmount: true, paidAmount: true,
            status: true, hotelEyeStatus: true, hotelEyeFiledAt: true,
            property: { select: { name: true } },
          },
          orderBy: { checkIn: 'desc' },
        },
      },
    })
    if (!guest) return apiError('Guest not found', 404)
    return apiResponse(guest)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(req, 'guests')
    const { id } = await params
    const parsed = guestSchema.partial().safeParse(await req.json())
    if (!parsed.success) return apiError(parsed.error.errors[0].message)

    const guest = await prisma.guest.update({
      where: { id },
      data: blankToNull(parsed.data) as never,
    })
    return apiResponse(guest)
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return apiError('Another guest already has this CNIC or passport', 409)
    }
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(req, 'guests')
    const { id } = await params

    /* Bookings survive the profile — their own guestName/CNIC columns still hold
       what was filed, and deleting a stay because someone tidied a duplicate
       profile would destroy the filing record an inspector asks for. */
    await prisma.guest.delete({ where: { id } })
    return apiResponse({ message: 'Guest profile deleted' })
  } catch (error) {
    return handleApiError(error)
  }
}
