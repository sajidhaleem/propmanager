import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { requirePermission } from '@/lib/permissionGuard'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'
import { guestRiskSchema, defaultReviewDate } from '@/lib/guestRisk'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/guests/[id]/risk — set or lift a do-not-book flag.
 *
 * Its own route rather than a field on the guest PATCH, so the permission check
 * is unambiguous and every change lands in the audit log. Refusing someone a
 * room is a decision that has to be attributable: who, when, on what grounds,
 * and what it looked like before.
 *
 * A null level lifts the flag. Lifting is audited exactly like setting.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(req, 'guest_risk')
    const session = await getSessionFromRequest(req)
    if (!session) return apiError('Unauthorized', 401)

    const { id } = await params
    const parsed = guestRiskSchema.safeParse(await req.json())
    if (!parsed.success) return apiError(parsed.error.errors[0].message)

    const before = await prisma.guest.findUnique({
      where: { id },
      select: {
        name: true,
        riskLevel: true, riskReason: true, riskNote: true,
        riskSetBy: true, riskSetAt: true, riskReviewAt: true,
      },
    })
    if (!before) return apiError('Guest not found', 404)

    const { riskLevel, riskReason, riskNote, riskReviewAt } = parsed.data
    const clearing = riskLevel === null

    const data = clearing
      ? {
          riskLevel: null, riskReason: null, riskNote: null,
          riskSetBy: null, riskSetAt: null, riskReviewAt: null,
        }
      : {
          riskLevel,
          riskReason: riskReason ?? null,
          riskNote: riskNote?.trim() || null,
          // the person, not the account id: the record has to stay readable
          // after someone leaves and their user row is deleted
          riskSetBy: session.name || session.email,
          riskSetAt: new Date(),
          /* A flag with no end date is one nobody ever revisits, so an absent
             review date becomes a year out rather than "never". */
          riskReviewAt: riskReviewAt ? new Date(riskReviewAt) : defaultReviewDate(),
        }

    const guest = await prisma.guest.update({ where: { id }, data })

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: clearing ? 'GUEST_RISK_CLEARED' : 'GUEST_RISK_SET',
        entity: 'Guest',
        entityId: id,
        oldValues: before as never,
        newValues: data as never,
        ipAddress: req.headers.get('x-forwarded-for') || null,
        userAgent: req.headers.get('user-agent') || null,
      },
    }).catch(() => {/* the decision stands even if the log write fails */})

    return apiResponse(guest)
  } catch (error) {
    return handleApiError(error)
  }
}
