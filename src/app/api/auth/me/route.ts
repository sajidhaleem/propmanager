import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return apiError('Unauthorized', 401)
  return apiResponse(session)
}
