import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PASSPORT_PROMPT = `This is the photo/bio data page of a passport.
Extract only from this page and return ONLY valid JSON — no markdown, no explanation:
{
  "passport_number": "passport number as printed",
  "name": "full name in English (as printed, given + surname)",
  "nationality": "nationality/country as printed",
  "gender": "Male or Female",
  "date_of_birth": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD"
}
Use empty string "" for any field that cannot be read clearly.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No image provided', 400)
    if (file.size > 10 * 1024 * 1024) return apiError('Image too large (max 10MB)', 400)

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: PASSPORT_PROMPT },
          ],
        },
      ],
    })

    const block = response.content[0]
    if (!block || block.type !== 'text') return apiError('Could not parse passport data from image', 422)
    let text = block.text.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
    }

    const extracted = JSON.parse(text)
    return apiResponse(extracted)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (err instanceof SyntaxError) return apiError('Could not parse passport data from image', 422)
    console.error('Passport extract error:', err)
    return apiError('Extraction failed. Please try again with a clearer image.', 500)
  }
}
