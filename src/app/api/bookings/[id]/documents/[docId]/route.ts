import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'

/* Only these render inline. Anything else (Office files, text) downloads even
   when ?inline=1 is asked for, so the browser is never handed an arbitrary
   uploaded type to execute in our origin. SVG and HTML are not upload-allowed
   and are deliberately absent here. */
const INLINE_SAFE = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
])

/* A filename reaches the header verbatim, so a non-ASCII name (an em dash, an
   accent) would throw ERR_INVALID_CHAR when Node writes it. Send a stripped
   ASCII fallback plus the real name RFC 5987-encoded. */
function contentDisposition(kind: 'inline' | 'attachment', name: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '')
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

// GET /api/bookings/[id]/documents/[docId] — download, or view with ?inline=1
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    await requireAuth(req)
    const { id, docId } = await params
    const document = await prisma.document.findFirst({ where: { id: docId, bookingId: id } })
    if (!document) return apiError('Document not found', 404)

    const wantsInline = req.nextUrl.searchParams.get('inline') === '1'
    const kind = wantsInline && INLINE_SAFE.has(document.mimeType) ? 'inline' : 'attachment'

    const buffer = Buffer.from(document.data, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': contentDisposition(kind, document.name),
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: any) {
    return handleApiError(error)
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
    return handleApiError(error)
  }
}
