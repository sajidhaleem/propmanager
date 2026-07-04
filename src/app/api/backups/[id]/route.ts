import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN'])
    const { id } = await params
    await prisma.backup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (e.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Failed to delete backup', 500)
  }
}
