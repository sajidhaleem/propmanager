// Exclude receiptData (base64 blob) from ordinary responses — the /receipt
// route serves it separately when actually needed
export const EXPENSE_LIST_SELECT = {
  id: true, date: true, category: true, subcategory: true, description: true, amount: true,
  paidAmount: true,
  vendor: true, notes: true, month: true, year: true,
  receiptMimeType: true, receiptName: true,
  createdAt: true, updatedAt: true,
} as const

// Second-level type for the categories where one bucket isn't specific enough.
// A category absent from this map simply renders no sub-type dropdown.
export const SUBCATEGORIES: Record<string, string[]> = {
  UTILITIES: [
    'ELECTRICITY', 'GAS', 'WATER', 'SEWERAGE', 'INTERNET', 'CABLE_TV',
    'LANDLINE', 'MOBILE', 'WATER_TANKER', 'LPG_CYLINDER', 'GENERATOR_FUEL',
    'SOLAR', 'WASTE_COLLECTION', 'SECURITY', 'SOCIETY_MAINTENANCE', 'OTHER',
  ],
  MAINTENANCE: [
    'PLUMBING', 'ELECTRICAL', 'AC_SERVICING', 'CARPENTRY', 'PAINTING',
    'PEST_CONTROL', 'APPLIANCE_SERVICE', 'LIFT_SERVICE', 'GARDENING',
    'WATER_TANK_CLEANING', 'GENERATOR_SERVICE', 'CCTV_SECURITY_SYSTEM', 'OTHER',
  ],
  REPAIRS: [
    'PLUMBING', 'ELECTRICAL', 'AC_UNIT', 'GEYSER', 'REFRIGERATOR',
    'WASHING_MACHINE', 'FURNITURE', 'DOOR_LOCK', 'WINDOW_GLASS', 'ROOF_LEAK',
    'FLOORING', 'WALL_DAMAGE', 'TV_ELECTRONICS', 'OTHER',
  ],
}

export const SUBCATEGORY_LABEL: Record<string, string> = {
  UTILITIES:   'Utility type',
  MAINTENANCE: 'Maintenance type',
  REPAIRS:     'Repair type',
}

const ACRONYMS = new Set(['TV', 'AC', 'LPG', 'CCTV'])

/** ELECTRICITY → "Electricity", CABLE_TV → "Cable TV", LPG_CYLINDER → "LPG cylinder" */
export function labelize(value: string): string {
  if (!value) return ''
  return value
    .split('_')
    .map((word, i) => {
      if (ACRONYMS.has(word)) return word
      const lower = word.toLowerCase()
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower
    })
    .join(' ')
}

/**
 * Returns the sub-type to store: the value itself when it belongs to the
 * category's list, otherwise null — so switching a booking from Utilities to
 * Cleaning can't leave a stale "ELECTRICITY" behind.
 */
export function normalizeSubcategory(category: string | undefined, sub: unknown): string | null {
  if (!category || typeof sub !== 'string' || !sub) return null
  return SUBCATEGORIES[category]?.includes(sub) ? sub : null
}
