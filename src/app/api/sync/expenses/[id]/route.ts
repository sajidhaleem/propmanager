import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'
import { ledgerSecretValid } from '@/lib/ledgerSyncAuth'
import { normalizeSubcategory } from '@/lib/expense'
import { expenseDateFields, hisaabMarker, syncExpenseSchema } from '@/lib/syncExpense'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Hisaab correcting or removing an expense it entered. Both are scoped to rows
 * carrying that entry's marker, so a guessed or stale id can never touch an
 * expense typed into this app. Guarded the same way as the POST beside it.
 */

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!ledgerSecretValid(req.headers.get('x-sync-secret'), 'LEDGER_WRITE_SECRET')) {
      return apiError('Not found', 404)
    }
    const { id } = await params

    const parsed = syncExpenseSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiError(parsed.error.errors[0].message)
    const { txId, day, amount, description, category } = parsed.data

    const row = await prisma.expense.findFirst({
      where: { id, notes: { contains: hisaabMarker(txId) } },
      select: { id: true, subcategory: true },
    })
    // Deleted here since. Say so rather than quietly recreate what someone removed.
    if (!row) return apiError('That expense is no longer in the property manager', 410)

    await prisma.expense.update({
      where: { id },
      data: {
        ...expenseDateFields(day),
        category,
        // A sub-type set here survives, unless the category change makes it stale.
        subcategory: normalizeSubcategory(category, row.subcategory),
        description,
        amount,
        paidAmount: amount,
      },
    })
    return apiResponse({ id })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    if (!ledgerSecretValid(req.headers.get('x-sync-secret'), 'LEDGER_WRITE_SECRET')) {
      return apiError('Not found', 404)
    }
    const { id } = await params
    const txId = new URL(req.url).searchParams.get('txId')
    if (!txId) return apiError('txId is required')

    // Already gone counts as done: the end state Hisaab asked for is reached.
    const { count } = await prisma.expense.deleteMany({
      where: { id, notes: { contains: hisaabMarker(txId) } },
    })
    return apiResponse({ deleted: count })
  } catch (error) {
    return handleApiError(error)
  }
}
