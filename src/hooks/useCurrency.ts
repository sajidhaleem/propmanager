'use client'

import { useUIStore } from '@/store/ui'
import { formatAmount, getCurrency } from '@/lib/currencies'

export function useCurrency() {
  const currency = useUIStore((s) => s.currency)
  const setCurrency = useUIStore((s) => s.setCurrency)
  const currencyInfo = getCurrency(currency)

  return {
    currency,
    setCurrency,
    currencyInfo,
    format: (amount: number, compact = false) => formatAmount(amount, currency, compact),
  }
}
