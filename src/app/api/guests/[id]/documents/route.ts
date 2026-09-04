import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissionGuard'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'
import { isScanKind } from '@/lib/scans'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
// Scans only — this endpoint exists to keep a guest's card image with the guest
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(req, 'guests')
    const { id } = await params
    const documents = await prisma.document.findMany({
      where: { guestId: id },
      select: { id: true, kind: true, name: true, mimeType: true, size: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return apiResponse(documents)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(req, 'guests')
    const { id } = await params

    const guest = await prisma.guest.findUnique({ where: { id }, select: { id: true } })
    if (!guest) return apiError('Guest not found', 404)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided')
    if (file.size > MAX_FILE_SIZE) return apiError('File too large. Maximum size is 5MB.')
    if (!ALLOWED_TYPES.includes(file.type)) return apiError(`Unsupported file type: ${file.type}`)

    /* Which card this is. Unrecognised values are stored as null rather than
       rejected — an ordinary document upload has no kind and is still valid. */
    const rawKind = formData.get('kind')
    const kind = isScanKind(rawKind) ? rawKind : null

    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')

    /* One image per card type: re-scanning replaces what is held rather than
       stacking a second copy, so "already scanned" stays a yes/no question. */
    if (kind) {
      await prisma.document.deleteMany({ where: { guestId: id, kind } })
    }

    const document = await prisma.document.create({
      data: { guestId: id, kind, name: file.name, mimeType: file.type, size: file.size, data: base64 },
      select: { id: true, kind: true, name: true, mimeType: true, size: true, createdAt: true },
    })
    return apiResponse(document, 201)
  } catch (error) {
    console.error('Guest document upload error:', error)
    return handleApiError(error, 'Upload failed')
  }
}
