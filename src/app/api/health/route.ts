import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - start

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV,
        db: { status: 'connected', latencyMs: latency },
        uptime: Math.floor(process.uptime()),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        db: { status: 'disconnected' },
        error: 'Database connection failed',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
