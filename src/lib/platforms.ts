export type PlatformItem = { value: string; label: string; fee: number; custom?: boolean }

export const DEFAULT_PLATFORMS: PlatformItem[] = [
  { value: 'AIRBNB',      label: 'Airbnb',      fee: 0 },
  { value: 'DIRECT',      label: 'Direct',      fee: 0 },
  { value: 'BOOKING_COM', label: 'Booking.com', fee: 0 },
  { value: 'VRBO',        label: 'VRBO',        fee: 0 },
  { value: 'OTHER',       label: 'Other',       fee: 0 },
]
