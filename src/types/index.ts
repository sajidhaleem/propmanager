export type Role = 'ADMIN' | 'MANAGER' | 'STAFF'
export type Platform = 'AIRBNB' | 'DIRECT' | 'BOOKING_COM' | 'VRBO' | 'OTHER'
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'
export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
export type ExpenseCategory = 'CLEANING' | 'MAINTENANCE' | 'UTILITIES' | 'SUPPLIES' | 'MARKETING' | 'PLATFORM_FEES' | 'INSURANCE' | 'TAXES' | 'SALARY' | 'REPAIRS' | 'OTHER'
export type PayoutType = 'SALARY' | 'BONUS' | 'COMMISSION' | 'REIMBURSEMENT' | 'CLEANING_FEE' | 'OTHER'
export type PayoutStatus = 'PENDING' | 'PAID' | 'CANCELLED'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatar?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Property {
  id: string
  name: string
  description?: string | null
  type: string
  capacity: number
  baseRate: number
  status: PropertyStatus
  amenities: string[]
  images: string[]
  createdAt: string
  updatedAt: string
  _count?: { bookings: number }
}

export interface Booking {
  id: string
  guestName: string
  guestEmail?: string | null
  guestPhone?: string | null
  checkIn: string
  checkOut: string
  nights: number
  rate: number
  cleaningFee: number
  platformFee: number
  totalAmount: number
  netAmount: number
  paidAmount: number
  platform: Platform
  status: BookingStatus
  notes?: string | null
  propertyId: string
  property?: Property
  income?: Income | null
  miscCharges?: number
  miscDescription?: string | null
  reminderAt?: string | null
  reminderNote?: string | null
  hotelEyeStatus?: string | null
  // Hotel Eye / guest identity
  guestCnic?: string | null
  guestFatherName?: string | null
  guestGender?: string | null
  guestAddress?: string | null
  guestProvince?: string | null
  guestDistrict?: string | null
  tempAddress?: string | null
  tempProvince?: string | null
  tempDistrict?: string | null
  purposeOfVisit?: string | null
  accompanyingMale?: number | null
  accompanyingFemale?: number | null
  accompanyingChildren?: number | null
  roomNumber?: string | null
  refName?: string | null
  refFatherName?: string | null
  refBusiness?: string | null
  refAddress?: string | null
  refCell?: string | null
  refVerified?: boolean | null
  createdAt: string
  updatedAt: string
}

export interface Income {
  id: string
  bookingId: string
  booking?: Booking
  grossAmount: number
  platformFee: number
  cleaningFee: number
  netAmount: number
  receivedAt: string
  month: number
  year: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: string
  date: string
  category: ExpenseCategory
  description: string
  amount: number
  vendor?: string | null
  receiptUrl?: string | null
  notes?: string | null
  month: number
  year: number
  createdAt: string
  updatedAt: string
}

export interface Payout {
  id: string
  recipientName: string
  amount: number
  date: string
  type: PayoutType
  description?: string | null
  status: PayoutStatus
  notes?: string | null
  month: number
  year: number
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  occupancyRate: number
  totalBookings: number
  activeBookings: number
  pendingBookings: number
  totalProperties: number
  revenueGrowth: number
  occupancyGrowth: number
}

export interface MonthlyRevenue {
  month: string
  revenue: number
  expenses: number
  net: number
}

export interface OccupancyData {
  propertyName: string
  occupancyRate: number
  bookedNights: number
  totalNights: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface FilterParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  platform?: string
  propertyId?: string
  startDate?: string
  endDate?: string
  year?: number
  month?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
