import { z } from 'zod'

export type Guest = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  cnic?: string | null
  fatherName?: string | null
  gender?: string | null
  address?: string | null
  province?: string | null
  district?: string | null
  passportNumber?: string | null
  nationality?: string | null
  passportExpiry?: string | null
  notes?: string | null
  _count?: { bookings: number }
}

export const guestSchema = z.object({
  name:           z.string().min(2, 'Guest name is required'),
  email:          z.string().email().or(z.literal('')).optional(),
  phone:          z.string().optional(),
  cnic:           z.string().optional(),
  fatherName:     z.string().optional(),
  gender:         z.string().optional(),
  address:        z.string().optional(),
  province:       z.string().optional(),
  district:       z.string().optional(),
  passportNumber: z.string().optional(),
  nationality:    z.string().optional(),
  passportExpiry: z.string().optional(),
  notes:          z.string().optional(),
})

/**
 * '' is what an untouched form field sends. Storing it would defeat the unique
 * index on cnic/passportNumber — the second guest saved with a blank CNIC would
 * collide with the first instead of both being "no CNIC on file".
 */
export function blankToNull<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
  ) as { [K in keyof T]: T[K] | null }
}
