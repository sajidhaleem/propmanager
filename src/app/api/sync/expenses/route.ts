import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'
import { ledgerSecretValid } from '@/lib/ledgerSyncAuth'
import { expenseDateFields, hisaabMarker, pktDayWindow, syncExpenseSchema } from '@/lib/syncExpense'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Hisaab enters guesthouse expenses here, so a cost recorded there once still
 * lands in this app's books.
 *
 * Machine-to-machine, like /api/export/ledger: listed in middleware PUBLIC_PATHS,
 * guarded by LEDGER_WRITE_SECRET, and 404 on a missing or wrong secret so it does
 * not announce itself. Expenses only — income here belongs to bookings and is
 * never created from outside.
 */
export async function POST(req: NextRequest) {
  try {
    if (!ledgerSecretValid(req.headers.get('x-sync-secret'), 'LEDGER_WRITE_SECRET')) {
      return apiError('Not found', 404)
    }

    const parsed = syncExpenseSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiError(parsed.error.errors[0].message)
    const { txId, day, amount, description, category } = parsed.data
    const marker = hisaabMarker(txId)

    // A retry after a lost reply: the row already exists, so hand back its id.
    const mine = await prisma.expense.findFirst({
      where: { notes: { contains: marker } },
      select: { id: true },
    })
    if (mine) return apiResponse({ id: mine.id, linked: false })

    // The same money already typed in here by hand. Link to it rather than add a
    // second copy. It stays this app's row, so Hisaab will not edit or delete it.
    // `notes: null` is spelled out because NOT(contains) drops NULL rows in SQL.
    const twin = await prisma.expense.findFirst({
      where: {
        date: pktDayWindow(day),
        amount: { gte: amount - 0.5, lt: amount + 0.5 },
        OR: [{ notes: null }, { NOT: { notes: { contains: 'hisaab:' } } }],
      },
      select: { id: true },
    })
    if (twin) return apiResponse({ id: twin.id, linked: true })

    const expense = await prisma.expense.create({
      data: {
        ...expenseDateFields(day),
        category,
        description,
        amount,
        // Recorded in Hisaab means the money has already left.
        paidAmount: amount,
        notes: `Entered in Hisaab · ${marker}`,
      },
      select: { id: true },
    })
    return apiResponse({ id: expense.id, linked: false }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
