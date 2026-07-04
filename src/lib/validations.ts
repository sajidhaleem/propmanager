import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const emailField = z
  .string()
  .email('Invalid email address')
  .transform((v) => v.toLowerCase().trim())

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: emailField,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).default('STAFF'),
})

export const bookingBaseSchema = z.object({
  guestName: z.string().min(2, 'Guest name is required'),
  guestEmail: z.string().email().optional().or(z.literal('')),
  guestPhone: z.string().optional(),
  checkIn: z.string().or(z.date()),
  checkOut: z.string().or(z.date()),
  rate: z.number().min(0, 'Rate must be positive'),
  cleaningFee: z.number().min(0).default(0),
  platformFee: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  miscCharges: z.number().min(0).default(0),
  miscDescription: z.string().nullable().optional(),
  platform: z.enum(['AIRBNB', 'DIRECT', 'BOOKING_COM', 'VRBO', 'OTHER']),
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']).default('CONFIRMED'),
  propertyId: z.string().min(1, 'Property is required'),
  notes: z.string().optional(),
  reminderAt: z.string().nullable().optional(),
  reminderNote: z.string().nullable().optional(),
  hotelEyeStatus: z.enum(['NOT_ENTERED', 'ENTERED']).optional(),
  // Hotel Eye / Guest identity
  guestCnic: z.string().optional(),
  guestFatherName: z.string().optional(),
  guestGender: z.string().optional(),
  guestAddress: z.string().optional(),
  guestProvince: z.string().optional(),
  guestDistrict: z.string().optional(),
  tempAddress: z.string().optional(),
  tempProvince: z.string().optional(),
  tempDistrict: z.string().optional(),
  purposeOfVisit: z.string().optional(),
  accompanyingMale: z.number().int().min(0).optional(),
  accompanyingFemale: z.number().int().min(0).optional(),
  accompanyingChildren: z.number().int().min(0).optional(),
  roomNumber: z.string().optional(),
  // Hotel Eye reference/dealer
  refName: z.string().optional(),
  refFatherName: z.string().optional(),
  refBusiness: z.string().optional(),
  refAddress: z.string().optional(),
  refCell: z.string().optional(),
  refVerified: z.boolean().optional(),
})

export const bookingSchema = bookingBaseSchema.superRefine((data, ctx) => {
  const ci = new Date(data.checkIn)
  const co = new Date(data.checkOut)
  if (isNaN(ci.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['checkIn'], message: 'Invalid check-in date' })
    return
  }
  if (isNaN(co.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['checkOut'], message: 'Invalid check-out date' })
    return
  }
  if (co <= ci) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['checkOut'], message: 'Check-out must be after check-in' })
  }
})

export const propertySchema = z.object({
  name: z.string().min(2, 'Property name is required'),
  description: z.string().optional(),
  type: z.string().default('room'),
  capacity: z.number().int().min(1),
  baseRate: z.number().min(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).default('ACTIVE'),
  amenities: z.array(z.string()).default([]),
})

export const expenseSchema = z.object({
  date: z.string().or(z.date()),
  category: z.enum([
    'CLEANING', 'MAINTENANCE', 'UTILITIES', 'SUPPLIES', 'MARKETING',
    'PLATFORM_FEES', 'INSURANCE', 'TAXES', 'SALARY', 'REPAIRS', 'OTHER',
  ]),
  description: z.string().min(2, 'Description is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  vendor: z.string().optional(),
  notes: z.string().optional(),
})

export const payoutSchema = z.object({
  recipientName: z.string().min(2, 'Recipient name is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  date: z.string().or(z.date()),
  type: z.enum(['SALARY', 'BONUS', 'COMMISSION', 'REIMBURSEMENT', 'CLEANING_FEE', 'OTHER']),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).default('PENDING'),
  notes: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type BookingInput = z.infer<typeof bookingSchema>
export type PropertyInput = z.infer<typeof propertySchema>
export type ExpenseInput = z.infer<typeof expenseSchema>
export type PayoutInput = z.infer<typeof payoutSchema>
