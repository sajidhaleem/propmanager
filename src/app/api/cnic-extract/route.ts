import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FRONT_PROMPT = `This is the FRONT side of a Pakistani CNIC (Computerized National Identity Card).
Extract only from the front face and return ONLY valid JSON — no markdown, no explanation:
{
  "cnic": "identity number with dashes, e.g. 12345-1234567-1",
  "name": "full name in English (top English name, not Urdu)",
  "father_name": "father's name in English",
  "gender": "Male or Female",
  "date_of_birth": "YYYY-MM-DD"
}
Use empty string "" for any field that cannot be read clearly.`

const BACK_PROMPT = `This is the BACK side of a Pakistani CNIC (Computerized National Identity Card).
Extract only from the back and return ONLY valid JSON — no markdown, no explanation:
{
  "address": "full permanent address in English as printed on the card"
}
Use empty string "" if the address cannot be read clearly.`

const BOTH_PROMPT = `This image may be a Pakistani CNIC (Computerized National Identity Card) — front or back side.
Extract all readable fields and return ONLY valid JSON — no markdown, no explanation:
{
  "cnic": "identity number with dashes, e.g. 12345-1234567-1",
  "name": "full name in English",
  "father_name": "father's name in English",
  "gender": "Male or Female",
  "date_of_birth": "YYYY-MM-DD",
  "address": "full permanent address in English"
}
Use empty string "" for any field not visible on this side.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const side = (formData.get('side') as string | null) ?? 'both'

    if (!file) return apiError('No image provided', 400)
    if (file.size > 10 * 1024 * 1024) return apiError('Image too large (max 10MB)', 400)

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const prompt = side === 'front' ? FRONT_PROMPT : side === 'back' ? BACK_PROMPT : BOTH_PROMPT

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    let text = (response.content[0] as any).text.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
    }

    const extracted = JSON.parse(text)
    return apiResponse(extracted)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (err instanceof SyntaxError) return apiError('Could not parse CNIC data from image', 422)
    console.error('CNIC extract error:', err)
    return apiError('Extraction failed: ' + err.message, 500)
  }
}
