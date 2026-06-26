import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const key = new URL(req.url).searchParams.get('key')
    if (key) {
      const setting = await prisma.setting.findUnique({ where: { key } })
      return NextResponse.json({ success: true, data: setting?.value ?? null })
    }
    const all = await prisma.setting.findMany()
    const map = Object.fromEntries(all.map(s => [s.key, s.value]))
    return NextResponse.json({ success: true, data: map })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return apiError('Unauthorized', 401)
    return apiError('Internal server error', 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN'])
    const { key, value } = await req.json()
    if (!key) return apiError('key is required')
    const setting = await prisma.setting.upsert({
      where:  { key },
      update: { value },
      create: { key, value },
    })
    return NextResponse.json({ success: true, data: setting.value })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (e.message === 'Forbidden')    return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}
