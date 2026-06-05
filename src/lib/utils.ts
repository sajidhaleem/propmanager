import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'PKR'): string {
  try {
    const { getCurrency, formatAmount } = require('./currencies')
    return formatAmount(amount, currency)
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'PKR' ? 'USD' : currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }
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
    AIRBNB: 'bg-rose-100 text-rose-700',
    DIRECT: 'bg-blue-100 text-blue-700',
    BOOKING_COM: 'bg-indigo-100 text-indigo-700',
    VRBO: 'bg-orange-100 text-orange-700',
    OTHER: 'bg-gray-100 text-gray-700',
  }
  return colors[platform] || colors.OTHER
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    CHECKED_IN: 'bg-blue-100 text-blue-700',
    CHECKED_OUT: 'bg-gray-100 text-gray-700',
    CANCELLED: 'bg-red-100 text-red-700',
    NO_SHOW: 'bg-orange-100 text-orange-700',
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-gray-100 text-gray-700',
    MAINTENANCE: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    UNPAID: 'bg-red-100 text-red-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
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
