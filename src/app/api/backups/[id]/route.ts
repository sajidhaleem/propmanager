import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.backup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError('Failed to delete backup', 500)
  }
}
