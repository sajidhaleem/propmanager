import { z } from 'zod'
import { expenseSchema } from '@/lib/validations'

/**
 * The expense Hisaab sends when a guesthouse cost is recorded there.
 *
 * Pure — no Prisma — so the parts that are easy to get wrong (day boundaries,
 * the ownership marker) are unit-tested without a database.
 */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000

/** What the expense form would store for a calendar day: UTC midnight. */
export function expenseDateFields(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`)
  return { date, month: date.getUTCMonth() + 1, year: date.getUTCFullYear() }
}

export const syncExpenseSchema = z.object({
  /** Hisaab's transaction id. Ties the row to its origin for edits and deletes. */
  txId: z.string().min(1).max(100),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'day must be YYYY-MM-DD')
    // 2026-02-31 matches the pattern but rolls over to March.
    .refine((d) => !Number.isNaN(Date.parse(d)) && expenseDateFields(d).date.toISOString().startsWith(d), 'day is not a real date'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().trim().min(2, 'Description is required').max(500),
  category: expenseSchema.shape.category,
})

export type SyncExpenseInput = z.infer<typeof syncExpenseSchema>

/**
 * Written into notes on every expense Hisaab creates. Only rows carrying the
 * marker for a given entry can be edited or deleted from Hisaab — anything typed
 * into this app stays editable only here.
 */
export const hisaabMarker = (txId: string) => `hisaab:${txId}`

/**
 * Every instant in one Pakistani calendar day, for matching the same expense
 * entered on both sides. Hisaab thinks in PKT days; this app stores UTC midnight.
 */
export function pktDayWindow(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  const gte = new Date(Date.UTC(y, m - 1, d) - PKT_OFFSET_MS)
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) }
}
