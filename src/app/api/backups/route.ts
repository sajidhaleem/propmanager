import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createBackup } from '@/lib/backup'
import { requireRole } from '@/lib/auth'
import { apiError } from '@/lib/utils'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN'])
    const backups = await prisma.backup.findMany({
      select: { id: true, label: true, recordCount: true, createdBy: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: backups })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (e.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Failed to fetch backups', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(req, ['ADMIN'])
    const body = await req.json().catch(() => ({}))
    const label = body.label || `Manual — ${format(new Date(), 'MMM d, yyyy HH:mm')}`
    const backup = await createBackup(label, session.email)
    return NextResponse.json({ success: true, data: { id: backup.id, label: backup.label, recordCount: backup.recordCount, createdAt: backup.createdAt } })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (e.message === 'Forbidden') return apiError('Forbidden', 403)
    console.error('Backup error:', e)
    return apiError('Failed to create backup', 500)
  }
}
