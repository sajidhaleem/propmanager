import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createBackup } from '@/lib/backup'
import { apiError } from '@/lib/utils'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const backups = await prisma.backup.findMany({
      select: { id: true, label: true, recordCount: true, createdBy: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: backups })
  } catch (e) {
    return apiError('Failed to fetch backups', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const label = body.label || `Manual — ${format(new Date(), 'MMM d, yyyy HH:mm')}`
    const createdBy = req.headers.get('x-user-email') || undefined
    const backup = await createBackup(label, createdBy)
    return NextResponse.json({ success: true, data: { id: backup.id, label: backup.label, recordCount: backup.recordCount, createdAt: backup.createdAt } })
  } catch (e) {
    console.error('Backup error:', e)
    return apiError('Failed to create backup', 500)
  }
}
