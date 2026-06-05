export interface Currency {
  code: string
  name: string
  symbol: string
  locale: string
  flag: string
}

export const CURRENCIES: Currency[] = [
  // ── Most Used / Highlighted ───────────────────────────────────
  { code: 'PKR', name: 'Pakistani Rupee',        symbol: '₨',  locale: 'ur-PK', flag: '🇵🇰' },
  { code: 'USD', name: 'US Dollar',              symbol: '$',  locale: 'en-US', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro',                   symbol: '€',  locale: 'de-DE', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',          symbol: '£',  locale: 'en-GB', flag: '🇬🇧' },
  { code: 'AED', name: 'UAE Dirham',             symbol: 'د.إ',locale: 'ar-AE', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal',            symbol: '﷼',  locale: 'ar-SA', flag: '🇸🇦' },

  // ── Asia ─────────────────────────────────────────────────────
  { code: 'INR', name: 'Indian Rupee',           symbol: '₹',  locale: 'en-IN', flag: '🇮🇳' },
  { code: 'BDT', name: 'Bangladeshi Taka',       symbol: '৳',  locale: 'bn-BD', flag: '🇧🇩' },
  { code: 'LKR', name: 'Sri Lankan Rupee',       symbol: 'Rs', locale: 'si-LK', flag: '🇱🇰' },
  { code: 'NPR', name: 'Nepalese Rupee',         symbol: 'रू', locale: 'ne-NP', flag: '🇳🇵' },
  { code: 'AFN', name: 'Afghan Afghani',         symbol: '؋',  locale: 'ps-AF', flag: '🇦🇫' },
  { code: 'CNY', name: 'Chinese Yuan',           symbol: '¥',  locale: 'zh-CN', flag: '🇨🇳' },
  { code: 'JPY', name: 'Japanese Yen',           symbol: '¥',  locale: 'ja-JP', flag: '🇯🇵' },
  { code: 'KRW', name: 'South Korean Won',       symbol: '₩',  locale: 'ko-KR', flag: '🇰🇷' },
  { code: 'THB', name: 'Thai Baht',              symbol: '฿',  locale: 'th-TH', flag: '🇹🇭' },
  { code: 'SGD', name: 'Singapore Dollar',       symbol: 'S$', locale: 'en-SG', flag: '🇸🇬' },
  { code: 'MYR', name: 'Malaysian Ringgit',      symbol: 'RM', locale: 'ms-MY', flag: '🇲🇾' },
  { code: 'IDR', name: 'Indonesian Rupiah',      symbol: 'Rp', locale: 'id-ID', flag: '🇮🇩' },
  { code: 'PHP', name: 'Philippine Peso',        symbol: '₱',  locale: 'en-PH', flag: '🇵🇭' },
  { code: 'VND', name: 'Vietnamese Dong',        symbol: '₫',  locale: 'vi-VN', flag: '🇻🇳' },
  { code: 'HKD', name: 'Hong Kong Dollar',       symbol: 'HK$',locale: 'zh-HK', flag: '🇭🇰' },
  { code: 'TWD', name: 'New Taiwan Dollar',      symbol: 'NT$',locale: 'zh-TW', flag: '🇹🇼' },

  // ── Middle East / Africa ──────────────────────────────────────
  { code: 'QAR', name: 'Qatari Riyal',           symbol: 'ر.ق',locale: 'ar-QA', flag: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar',          symbol: 'د.ك',locale: 'ar-KW', flag: '🇰🇼' },
  { code: 'BHD', name: 'Bahraini Dinar',         symbol: 'BD', locale: 'ar-BH', flag: '🇧🇭' },
  { code: 'OMR', name: 'Omani Rial',             symbol: 'ر.ع.',locale: 'ar-OM', flag: '🇴🇲' },
  { code: 'JOD', name: 'Jordanian Dinar',        symbol: 'JD', locale: 'ar-JO', flag: '🇯🇴' },
  { code: 'EGP', name: 'Egyptian Pound',         symbol: 'E£', locale: 'ar-EG', flag: '🇪🇬' },
  { code: 'IQD', name: 'Iraqi Dinar',            symbol: 'ع.د',locale: 'ar-IQ', flag: '🇮🇶' },
  { code: 'TRY', name: 'Turkish Lira',           symbol: '₺',  locale: 'tr-TR', flag: '🇹🇷' },
  { code: 'IRR', name: 'Iranian Rial',           symbol: '﷼',  locale: 'fa-IR', flag: '🇮🇷' },
  { code: 'ZAR', name: 'South African Rand',     symbol: 'R',  locale: 'en-ZA', flag: '🇿🇦' },
  { code: 'NGN', name: 'Nigerian Naira',         symbol: '₦',  locale: 'en-NG', flag: '🇳🇬' },
  { code: 'KES', name: 'Kenyan Shilling',        symbol: 'KSh',locale: 'sw-KE', flag: '🇰🇪' },
  { code: 'GHS', name: 'Ghanaian Cedi',          symbol: '₵',  locale: 'en-GH', flag: '🇬🇭' },
  { code: 'ETB', name: 'Ethiopian Birr',         symbol: 'Br', locale: 'am-ET', flag: '🇪🇹' },
  { code: 'MAD', name: 'Moroccan Dirham',        symbol: 'DH', locale: 'ar-MA', flag: '🇲🇦' },

  // ── Europe ────────────────────────────────────────────────────
  { code: 'CHF', name: 'Swiss Franc',            symbol: 'Fr', locale: 'de-CH', flag: '🇨🇭' },
  { code: 'NOK', name: 'Norwegian Krone',        symbol: 'kr', locale: 'nb-NO', flag: '🇳🇴' },
  { code: 'SEK', name: 'Swedish Krona',          symbol: 'kr', locale: 'sv-SE', flag: '🇸🇪' },
  { code: 'DKK', name: 'Danish Krone',           symbol: 'kr', locale: 'da-DK', flag: '🇩🇰' },
  { code: 'PLN', name: 'Polish Zloty',           symbol: 'zł', locale: 'pl-PL', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna',           symbol: 'Kč', locale: 'cs-CZ', flag: '🇨🇿' },
  { code: 'HUF', name: 'Hungarian Forint',       symbol: 'Ft', locale: 'hu-HU', flag: '🇭🇺' },
  { code: 'RON', name: 'Romanian Leu',           symbol: 'lei',locale: 'ro-RO', flag: '🇷🇴' },
  { code: 'RUB', name: 'Russian Ruble',          symbol: '₽',  locale: 'ru-RU', flag: '🇷🇺' },
  { code: 'UAH', name: 'Ukrainian Hryvnia',      symbol: '₴',  locale: 'uk-UA', flag: '🇺🇦' },

  // ── Americas ──────────────────────────────────────────────────
  { code: 'CAD', name: 'Canadian Dollar',        symbol: 'CA$',locale: 'en-CA', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar',      symbol: 'A$', locale: 'en-AU', flag: '🇦🇺' },
  { code: 'NZD', name: 'New Zealand Dollar',     symbol: 'NZ$',locale: 'en-NZ', flag: '🇳🇿' },
  { code: 'MXN', name: 'Mexican Peso',           symbol: 'MX$',locale: 'es-MX', flag: '🇲🇽' },
  { code: 'BRL', name: 'Brazilian Real',         symbol: 'R$', locale: 'pt-BR', flag: '🇧🇷' },
  { code: 'ARS', name: 'Argentine Peso',         symbol: 'AR$',locale: 'es-AR', flag: '🇦🇷' },
  { code: 'COP', name: 'Colombian Peso',         symbol: 'CO$',locale: 'es-CO', flag: '🇨🇴' },
  { code: 'CLP', name: 'Chilean Peso',           symbol: 'CL$',locale: 'es-CL', flag: '🇨🇱' },
]

export const DEFAULT_CURRENCY = 'PKR'

export function getCurrency(code: string): Currency {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]
}

export function formatAmount(
  amount: number,
  currencyCode: string,
  compact = false
): string {
  const currency = getCurrency(currencyCode)

  try {
    const formatted = new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: currencyCode === 'JPY' || currencyCode === 'KRW' || currencyCode === 'VND' ? 0 : 2,
      notation: compact && Math.abs(amount) >= 1_000_000 ? 'compact' : 'standard',
    }).format(amount)
    return formatted
  } catch {
    // Fallback for unsupported locale/currency combos
    return `${currency.symbol}${Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}${amount < 0 ? '-' : ''}`
  }
}

// Popular currencies shown at the top of the selector
export const POPULAR_CURRENCY_CODES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'CAD', 'AUD']
