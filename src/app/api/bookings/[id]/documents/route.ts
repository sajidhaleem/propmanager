import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

// GET /api/bookings/[id]/documents — list documents for a booking
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req)
    const { id } = await params
    const documents = await prisma.document.findMany({
      where: { bookingId: id },
      select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return apiResponse(documents)
  } catch (error: any) {
    return handleApiError(error)
  }
}

// POST /api/bookings/[id]/documents — upload document
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req)
    const { id } = await params

    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking) return apiError('Booking not found', 404)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided')

    if (file.size > MAX_FILE_SIZE) return apiError('File too large. Maximum size is 5MB.')
    if (!ALLOWED_TYPES.includes(file.type)) return apiError(`Unsupported file type: ${file.type}`)

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const document = await prisma.document.create({
      data: {
        bookingId: id,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        data: base64,
      },
      select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
    })

    return apiResponse(document, 201)
  } catch (error: any) {
    console.error('Document upload error:', error)
    return handleApiError(error, 'Upload failed')
  }
}
