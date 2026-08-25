import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, fmt = 'MMM dd, yyyy'): string {
  return format(new Date(date), fmt)
}

export function formatDateRange(checkIn: Date | string, checkOut: Date | string): string {
  return `${format(new Date(checkIn), 'MMM dd')} – ${format(new Date(checkOut), 'MMM dd, yyyy')}`
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function calculateNights(checkIn: Date | string, checkOut: Date | string): number {
  return differenceInDays(new Date(checkOut), new Date(checkIn))
}

export function getOccupancyRate(bookedNights: number, totalNights: number): number {
  if (totalNights === 0) return 0
  return Math.round((bookedNights / totalNights) * 100)
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    AIRBNB: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    DIRECT: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    BOOKING_COM: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    VRBO: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300',
  }
  return colors[platform] || colors.OTHER
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
    CHECKED_IN: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    CHECKED_OUT: 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    NO_SHOW: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    INACTIVE: 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300',
    MAINTENANCE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
    PAID: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    UNPAID: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  }
  return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300'
}

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generatePagination(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5, '...', totalPages]
  }
  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

export function apiResponse<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status })
}

export function apiError(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export function handleApiError(error: unknown, fallbackMessage = 'Internal server error') {
  const message = error instanceof Error ? error.message : ''
  if (message === 'Unauthorized') return apiError('Unauthorized', 401)
  if (message === 'Forbidden') return apiError('Forbidden', 403)
  return apiError(fallbackMessage, 500)
}

type MonthlyAmountGroup = { year: number; month: number; _sum: { paidAmount: number | null } }

/**
 * Combines an expense groupBy and a payout groupBy (same shape: year/month/_sum.paidAmount)
 * into the totals for one year/month, matching the merge logic previously
 * duplicated in the dashboard stats and reports routes.
 *
 * Cash basis: sums actual paidAmount, not the full logged amount/liability —
 * an expense or payout only counts once real money has moved.
 */
export function getMonthlyExpenseTotal(
  expensesByMonth: MonthlyAmountGroup[],
  payoutsByMonth: MonthlyAmountGroup[],
  year: number,
  month: number
) {
  const exp = expensesByMonth.find((e) => e.year === year && e.month === month)
  const pay = payoutsByMonth.find((p) => p.year === year && p.month === month)
  const expenses = exp?._sum.paidAmount || 0
  const payouts = pay?._sum.paidAmount || 0
  return { expenses, payouts, total: expenses + payouts }
}

// ── Payment status ──────────────────────────────────────────────────────────

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING'

/**
 * Payment state is derived from the amounts rather than stored as its own
 * column. paidAmount is editable inline in the bookings table, so a stored
 * copy would drift the moment someone corrected a figure; deriving it also
 * means every historical booking is classified without a backfill.
 *
 * Settled first, so a zero-value booking (nothing owed) and an overpayment
 * both read as Paid rather than falling through to Pending.
 */
export function getPaymentStatus(
  totalAmount: number,
  paidAmount: number | null | undefined
): PaymentStatus {
  const paid = paidAmount ?? 0
  if (paid >= totalAmount) return 'PAID'
  if (paid > 0) return 'PARTIAL'
  return 'PENDING'
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  PAID:    { label: 'Paid',           className: 'text-green-600 border-green-600/40 bg-green-500/10' },
  PARTIAL: { label: 'Partially Paid', className: 'text-amber-500 border-amber-500/40 bg-amber-500/10' },
  PENDING: { label: 'Pending',        className: 'text-rose-500 border-rose-500/40 bg-rose-500/10' },
}
