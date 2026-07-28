import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError, handleApiError } from '@/lib/utils'

// GET /api/expenses/[id]/receipt — view the scanned bill image
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req)
    const { id } = await params
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { receiptData: true, receiptMimeType: true, receiptName: true },
    })
    if (!expense?.receiptData) return apiError('Receipt not found', 404)

    const buffer = Buffer.from(expense.receiptData, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': expense.receiptMimeType || 'image/jpeg',
        'Content-Disposition': `inline; filename="${expense.receiptName || 'receipt'}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    return handleApiError(error)
  }
}
