import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)

    const hotelEyeUrl = process.env.HOTEL_EYE_URL
    if (!hotelEyeUrl) {
      return apiError('Hotel Eye tool URL not configured (HOTEL_EYE_URL)', 503)
    }

    const body = await req.json()

    const res = await fetch(`${hotelEyeUrl.replace(/\/$/, '')}/fill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hotel-Eye-Secret': process.env.HOTEL_EYE_SECRET || '',
      },
      body: JSON.stringify(body),
      // 10-second timeout — if the PC is off, fail fast
      signal: AbortSignal.timeout(10_000),
    })

    const json = await res.json()
    if (!res.ok) return apiError(json.error || 'Hotel Eye tool returned an error', res.status)
    return NextResponse.json({ success: true, data: json })
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return apiError('Hotel Eye tool is not reachable — is the PC running start-tunnel.bat?', 503)
    }
    if (err.message === 'Unauthorized') return apiError('Unauthorized', 401)
    console.error('Hotel Eye proxy error:', err)
    return apiError('Could not reach Hotel Eye tool: ' + err.message, 503)
  }
}
