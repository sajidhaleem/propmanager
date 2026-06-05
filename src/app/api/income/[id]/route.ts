import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'
import { z } from 'zod'

const incomeUpdateSchema = z.object({
  notes:       z.string().nullable().optional(),
  receivedAt:  z.string().optional(),
  grossAmount: z.number().positive().optional(),
  platformFee: z.number().min(0).optional(),
  cleaningFee: z.number().min(0).optional(),
  netAmount:   z.number().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER'])
    const { id } = await params
    const body   = await req.json()
    const result = incomeUpdateSchema.safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const updateData: any = { ...result.data }
    if (updateData.receivedAt) {
      const d            = new Date(updateData.receivedAt)
      updateData.receivedAt = d
      updateData.month   = d.getMonth() + 1
      updateData.year    = d.getFullYear()
    }

    const income = await prisma.income.update({
      where: { id },
      data:  updateData,
      include: {
        booking: { include: { property: { select: { id: true, name: true } } } },
      },
    })
    return apiResponse(income)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden')    return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(req, ['ADMIN'])
    const { id } = await params
    await prisma.income.delete({ where: { id } })
    return apiResponse({ message: 'Income record deleted' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden')    return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}
