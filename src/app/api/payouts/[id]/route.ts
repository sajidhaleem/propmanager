import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { payoutSchema } from '@/lib/validations'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER'])
    const { id } = await params
    const body = await req.json()
    const result = payoutSchema.partial().safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const data: any = { ...result.data }
    if (data.date) {
      const date = new Date(data.date)
      if (isNaN(date.getTime())) return apiError('Invalid date')
      data.date = date
      data.month = date.getMonth() + 1
      data.year = date.getFullYear()
    }

    const payout = await prisma.payout.update({ where: { id }, data })
    return apiResponse(payout)
  } catch (error: any) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER'])
    const { id } = await params
    await prisma.payout.delete({ where: { id } })
    return apiResponse({ message: 'Payout deleted' })
  } catch (error: any) {
    return handleApiError(error)
  }
}
