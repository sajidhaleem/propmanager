import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN'])
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    return apiResponse(users)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}
