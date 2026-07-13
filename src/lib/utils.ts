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

type MonthlyAmountGroup = { year: number; month: number; _sum: { amount: number | null } }

/**
 * Combines an expense groupBy and a payout groupBy (same shape: year/month/_sum.amount)
 * into the totals for one year/month, matching the merge logic previously
 * duplicated in the dashboard stats and reports routes.
 */
export function getMonthlyExpenseTotal(
  expensesByMonth: MonthlyAmountGroup[],
  payoutsByMonth: MonthlyAmountGroup[],
  year: number,
  month: number
) {
  const exp = expensesByMonth.find((e) => e.year === year && e.month === month)
  const pay = payoutsByMonth.find((p) => p.year === year && p.month === month)
  const expenses = exp?._sum.amount || 0
  const payouts = pay?._sum.amount || 0
  return { expenses, payouts, total: expenses + payouts }
}
