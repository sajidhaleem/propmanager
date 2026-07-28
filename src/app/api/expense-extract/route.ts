import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'
import { SUBCATEGORIES, normalizeSubcategory } from '@/lib/expense'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORIES = [
  'CLEANING', 'MAINTENANCE', 'UTILITIES', 'SUPPLIES', 'MARKETING',
  'PLATFORM_FEES', 'INSURANCE', 'TAXES', 'SALARY', 'REPAIRS', 'OTHER',
]

const SUBCATEGORY_GUIDE = Object.entries(SUBCATEGORIES)
  .map(([cat, subs]) => `  - if category is ${cat}: ${subs.join(', ')}`)
  .join('\n')

const PROMPT = `This is a photo of a bill, receipt, or invoice for a small guesthouse's expenses.
Extract the following and return ONLY valid JSON — no markdown, no explanation:
{
  "vendor": "the merchant / supplier / company name as printed",
  "amount": "the final total amount paid, digits only, e.g. 4500.50",
  "date": "the bill/transaction date as YYYY-MM-DD",
  "category": "best match from: ${CATEGORIES.join(', ')}",
  "subcategory": "the specific type, chosen from the list matching the category you picked (see below); empty string for categories not listed",
  "description": "a short one-line description of what this expense was for, e.g. 'Monthly electricity bill' or 'Plumbing repair — Room 3'"
}

Allowed "subcategory" values:
${SUBCATEGORY_GUIDE}

Use empty string "" for any field that cannot be read clearly. "category" must always be one of the listed values — use "OTHER" if unsure.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No image provided', 400)
    if (file.size > 8 * 1024 * 1024) return apiError('Image too large (max 8MB)', 400)

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
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const block = response.content[0]
    if (!block || block.type !== 'text') return apiError('Could not parse bill data from image', 422)
    let text = block.text.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
    }

    const extracted = JSON.parse(text)
    if (!CATEGORIES.includes(extracted.category)) extracted.category = 'OTHER'
    extracted.subcategory = normalizeSubcategory(extracted.category, extracted.subcategory) ?? ''
    return apiResponse(extracted)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (err instanceof SyntaxError) return apiError('Could not parse bill data from image', 422)
    console.error('Expense bill extract error:', err)
    return apiError('Extraction failed. Please try again with a clearer photo.', 500)
  }
}
