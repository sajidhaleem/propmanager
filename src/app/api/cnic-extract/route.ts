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

/* The back of a CNIC is printed in Urdu — there is no English on it except the
   identity number. The prompt asking for the address "in English as printed on
   the card" was therefore asking for text that does not exist, and the model
   correctly answered with the empty string the next line told it to use. It has
   to be told to translate. */
const URDU_ADDRESS_RULES = `The back of a CNIC is printed in URDU script. There is no English address on it.
Read the Urdu and TRANSLITERATE place names into English (فیصل آباد -> Faisalabad, لاہور -> Lahore).
Translate the structural words rather than transliterating them: مکان -> House, گلی -> Street, محلہ -> Mohalla, بلاک -> Block, سکیم -> Scheme, ٹاؤن -> Town, کالونی -> Colony, تحصیل -> Tehsil, ضلع -> District.
The card carries TWO addresses, each with its own Urdu label:
  موجودہ پتہ = present (current) address
  مستقل پتہ  = permanent address
Return them separately. Do not merge them and do not put one in both fields.
The identity number is printed in Latin digits at the top right — read it from there.
تحصیل names the tehsil and ضلع names the district; return each on its own as well as inside the address text.
The province is NOT printed on a CNIC. Never infer or invent it.`

const BACK_PROMPT = `This is the BACK side of a Pakistani CNIC (Computerized National Identity Card).
${URDU_ADDRESS_RULES}
Return ONLY valid JSON — no markdown, no explanation:
{
  "cnic": "identity number with dashes, e.g. 12345-1234567-1",
  "address": "full PERMANENT address (مستقل پتہ), transliterated into English",
  "present_address": "full PRESENT address (موجودہ پتہ), transliterated into English",
  "district": "district name only, in English, from ضلع",
  "tehsil": "tehsil name only, in English, from تحصیل"
}
Use empty string "" for any field that cannot be read clearly.`

const BOTH_PROMPT = `This image may be a Pakistani CNIC (Computerized National Identity Card) — front or back side.
The FRONT is in English and carries the name, father's name, gender and dates.
If this is the BACK, these rules apply:
${URDU_ADDRESS_RULES}
Extract all readable fields and return ONLY valid JSON — no markdown, no explanation:
{
  "cnic": "identity number with dashes, e.g. 12345-1234567-1",
  "name": "full name in English",
  "father_name": "father's name in English",
  "gender": "Male or Female",
  "date_of_birth": "YYYY-MM-DD",
  "address": "full PERMANENT address (مستقل پتہ), transliterated into English",
  "present_address": "full PRESENT address (موجودہ پتہ), transliterated into English",
  "district": "district name only, in English, from ضلع",
  "tehsil": "tehsil name only, in English, from تحصیل"
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

    /* The front is English and Haiku reads it accurately. The back is Urdu, and
       Haiku does not hold the two addresses apart on it — checked against a real
       card, it merged them, read a scheme number as a house number and invented
       a town name that is not on the card. Wrong text in an address that gets
       filed to a government portal is worse than an empty field, so the Urdu
       side is worth the stronger model. */
    const model = side === 'front' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-5'

    const response = await client.messages.create({
      model,
      /* Two transliterated addresses plus the identity fields, and Sonnet spends
         some of this budget on a thinking block. At 512 a long permanent address
         truncated the JSON mid-string, which surfaces as the 422 "could not
         parse" rather than as a short address. */
      max_tokens: 2048,
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

    /* Find the text block rather than assuming it is first: Sonnet returns a
       thinking block ahead of it, so indexing content[0] failed every scan with
       a 422 that looked like an unreadable photo. */
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return apiError('Could not parse CNIC data from image', 422)
    let text = block.text.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
    }

    const extracted = JSON.parse(text)
    return apiResponse(extracted)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (err instanceof SyntaxError) return apiError('Could not parse CNIC data from image', 422)
    console.error('CNIC extract error:', err)
    return apiError('Extraction failed. Please try again with a clearer image.', 500)
  }
}
