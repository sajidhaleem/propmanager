import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'

// GET /api/bookings/[id]/documents/[docId] — download file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    await requireAuth(req)
    const { id, docId } = await params
    const document = await prisma.document.findFirst({ where: { id: docId, bookingId: id } })
    if (!document) return apiError('Document not found', 404)

    const buffer = Buffer.from(document.data, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename="${document.name}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    return apiError('Internal server error', 500)
  }
}

// DELETE /api/bookings/[id]/documents/[docId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    await requireAuth(req)
    const { id, docId } = await params
    const document = await prisma.document.findFirst({ where: { id: docId, bookingId: id } })
    if (!document) return apiError('Document not found', 404)
    await prisma.document.delete({ where: { id: docId } })
    return apiResponse({ message: 'Document deleted' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    return apiError('Internal server error', 500)
  }
}
