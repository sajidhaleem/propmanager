'use client'

import React, { useState, useMemo, useEffect, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Edit, Trash2, Upload, FileText, X, Loader2, Copy, Check, Bell, CalendarDays, Send, ScanLine, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHero, HERO_CONTROL } from '@/components/layout/PageHero'
import { formatDate, getStatusColor, getPlatformColor, cn, getPaymentStatus, PAYMENT_STATUS_META } from '@/lib/utils'
import { isToday, isTomorrow, isYesterday, parseISO, format as fnsFormat } from 'date-fns'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking, type ScannedImage } from '@/types'
import { EmptyState } from '@/components/ui/empty-state'
import { GuestPicker } from '@/components/ui/GuestPicker'
import type { Guest } from '@/lib/guests'
import { DEFAULT_PLATFORMS, type PlatformItem } from '@/lib/platforms'
import { getFilingStatus, FILING_STATE_META } from '@/lib/hotelEye'
import { useSearchParams } from 'next/navigation'

async function fetchBookings(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/bookings?${qs}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

async function fetchProperties() {
  const res = await fetch('/api/properties')
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

const EMPTY_FORM = {
  guestName: '', guestEmail: '', guestPhone: '', checkIn: '', checkOut: '',
  rate: '', cleaningFee: '15', platformFee: '', platform: 'AIRBNB',
  status: 'CONFIRMED', propertyId: '', notes: '', platformOther: '',
  miscCharges: '', miscDescription: '', reminderAt: '', reminderNote: '',
  paidAmount: '',
  // Link to the saved guest profile, when the booking was made from one
  guestId: '',
  // Hotel Eye / Guest identity
  guestCnic: '', guestFatherName: '', guestGender: '', guestAddress: '',
  passportNumber: '', nationality: '', passportExpiry: '',
  guestProvince: '', guestDistrict: '',
  tempAddress: '', tempProvince: '', tempDistrict: '',
  purposeOfVisit: '',
  accompanyingMale: '0', accompanyingFemale: '0', accompanyingChildren: '0',
  roomNumber: '',
  // Reference/Dealer
  refName: '', refFatherName: '', refBusiness: '', refAddress: '', refCell: '',
  refVerified: false,
}

interface UploadedDoc { id: string; name: string; mimeType: string; size: number }

function checkInDateLabel(isoStr: string): string {
  const d = parseISO(isoStr)
  const dateStr = fnsFormat(d, 'MMM d, yyyy')
  if (isToday(d))     return `Today · ${dateStr}`
  if (isTomorrow(d))  return `Tomorrow · ${dateStr}`
  if (isYesterday(d)) return `Yesterday · ${dateStr}`
  return fnsFormat(d, 'EEEE, MMM d, yyyy')
}

function checkInDateKey(isoStr: string): string {
  return fnsFormat(parseISO(isoStr), 'yyyy-MM-dd')
}

// Convert a UTC ISO string to a value suitable for datetime-local input (local time)
function toLocalInput(utcStr: string): string {
  if (!utcStr) return ''
  const d = new Date(utcStr)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Convert a datetime-local input value (local time) back to a full UTC ISO string
function localInputToISO(localInput: string): string {
  if (!localInput) return ''
  return new Date(localInput).toISOString()
}

/* platform is a fixed enum, so a custom platform name is carried as a
   "[Label] " prefix on notes. Splitting it back out on edit keeps the label in
   its own field instead of leaving it buried in the notes text. */
function splitPlatformLabel(notes: string) {
  const m = notes.match(/^\[([^\]]+)\]\s*/)
  return m ? { label: m[1], rest: notes.slice(m[0].length) } : { label: '', rest: notes }
}

/* Mirrors INLINE_SAFE in the document download route — anything else is only
   offered as a download, since the API refuses to serve it inline anyway. */
const VIEWABLE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
])

function BookingsInner() {
  const queryClient = useQueryClient()
  const { format, currencyInfo } = useCurrency()
  const shouldReduceMotion = useReducedMotion()
  const [page, setPage] = useState(1)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [uploading, setUploading] = useState(false)
  /* Scans taken while creating a booking have no booking row to attach to yet,
     so they wait here and are filed once the booking is saved. */
  const [pendingScans, setPendingScans] = useState<ScannedImage[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [hotelEyeFilter, setHotelEyeFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null)
  const [editingAmountValue, setEditingAmountValue] = useState('')
  const [sortBy,    setSortBy]    = useState('checkIn')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [sectionOpen, setSectionOpen] = useState({ misc: false, reminder: false, hotelEye: false, reference: false })
  function toggleSection(key: keyof typeof sectionOpen) { setSectionOpen(s => ({ ...s, [key]: !s[key] })) }

  // Auto-open booking modal when arriving from the calendar day view with ?checkIn=
  const searchParams = useSearchParams()
  const view = searchParams.get('view') === 'hoteleye' ? 'hoteleye' : 'all'
  useEffect(() => {
    const checkIn = searchParams.get('checkIn')
    if (!checkIn) return
    // Format checkIn for datetime-local input (YYYY-MM-DDTHH:MM)
    const localValue = checkIn.length === 10 ? `${checkIn}T10:00` : checkIn.slice(0, 16)
    // Default checkout: next day at noon, kept in LOCAL wall-clock time
    // (toISOString() would shift it to UTC, -5h in PKT)
    const ciDate = new Date(localValue)
    const coDate = new Date(ciDate)
    coDate.setDate(coDate.getDate() + 1)
    coDate.setHours(12, 0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const checkOut = `${coDate.getFullYear()}-${pad(coDate.getMonth() + 1)}-${pad(coDate.getDate())}T12:00`
    setEditBooking(null)
    setForm({ ...EMPTY_FORM, checkIn: localValue, checkOut })
    setUploadedDocs([])
    setPendingScans([])
    setSectionOpen({ misc: false, reminder: false, hotelEye: false, reference: false })
    setModalOpen(true)
    // Drop ?checkIn= without reloading, but keep the view the user is looking at
    const keep = searchParams.get('view')
    window.history.replaceState({}, '', `/dashboard/bookings${keep ? `?view=${keep}` : ''}`)
  }, [searchParams])

  // Page 3 of "all" is rarely page 3 of the narrower Hotel Eye list
  useEffect(() => { setPage(1) }, [view])

  function handleSort(field: string) {
    if (field === sortBy) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('asc') }
    setPage(1)
  }

  const params: Record<string, string> = { page: String(page), limit: '15', sortBy, sortOrder }
  if (search) params.search = search
  if (statusFilter !== 'all') params.status = statusFilter
  // Custom platforms are stored as enum OTHER (label lives in notes)
  if (platformFilter !== 'all') params.platform = platformFilter.startsWith('OTHER:') ? 'OTHER' : platformFilter
  if (hotelEyeFilter !== 'all') params.hotelEyeStatus = hotelEyeFilter
  if (paymentFilter !== 'all') params.paymentStatus = paymentFilter
  // ?view=hoteleye narrows to stays with a card on file; ?view=all is everything
  if (view === 'hoteleye') params.view = 'hoteleye'

  const { data, isLoading } = useQuery({ queryKey: ['bookings', params], queryFn: () => fetchBookings(params) })
  const { data: propertiesData } = useQuery({ queryKey: ['properties'], queryFn: fetchProperties })
  /* Server-computed: the client only holds one filtered page, so it cannot
     answer "is every arrival today filed" on its own. */
  const { data: complianceData } = useQuery({
    queryKey: ['hotel-eye', 'compliance'],
    queryFn: async () => {
      const res = await fetch('/api/hotel-eye/compliance')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 5 * 60 * 1000,
  })
  const { data: platformsData } = useQuery<PlatformItem[]>({
    queryKey: ['settings', 'platforms'],
    queryFn: async () => {
      const res = await fetch('/api/settings?key=platforms')
      const json = await res.json()
      return (json.data as { items: PlatformItem[] } | null)?.items ?? DEFAULT_PLATFORMS
    },
    staleTime: 60_000,
  })
  const platforms: PlatformItem[] = platformsData ?? DEFAULT_PLATFORMS

  const bookings: Booking[] = data?.data?.data || []
  const total = data?.data?.total || 0
  const totalPages = data?.data?.totalPages || 1
  const properties = propertiesData?.data || []
  const compliance = complianceData?.data as
    | { arrivalsToday: number; filedToday: number; overdue: number; failed: number; clear: boolean }
    | undefined

  const groupedBookings = useMemo(() => {
    // Date-header grouping only makes sense when rows are ordered by check-in;
    // under other sorts render one flat group to avoid repeated date headers
    if (sortBy !== 'checkIn') {
      return bookings.length ? [{ dateKey: 'all', label: '', bookings }] : []
    }
    const groups: { dateKey: string; label: string; bookings: Booking[] }[] = []
    bookings.forEach((b) => {
      const key = checkInDateKey(b.checkIn)
      const last = groups[groups.length - 1]
      if (last && last.dateKey === key) last.bookings.push(b)
      else groups.push({ dateKey: key, label: checkInDateLabel(b.checkIn), bookings: [b] })
    })
    groups.forEach((g) => {
      g.bookings.sort((a, bk) => parseISO(a.checkIn).getHours() - parseISO(bk.checkIn).getHours())
    })
    return groups
  }, [bookings, sortBy])

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editBooking ? `/api/bookings/${editBooking.id}` : '/api/bookings'
      const res = await fetch(url, {
        method: editBooking ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            checkIn:    payload.checkIn    ? localInputToISO(payload.checkIn)    : undefined,
            checkOut:   payload.checkOut   ? localInputToISO(payload.checkOut)   : undefined,
            reminderAt: payload.reminderAt ? localInputToISO(payload.reminderAt) : null,
            rate: Number(payload.rate),
            cleaningFee: Number(payload.cleaningFee),
            platformFee: Number(payload.platformFee),
            paidAmount: Number(payload.paidAmount) || 0,
            miscCharges: Number(payload.miscCharges) || 0,
            accompanyingMale:     Number(payload.accompanyingMale)     || 0,
            accompanyingFemale:   Number(payload.accompanyingFemale)   || 0,
            accompanyingChildren: Number(payload.accompanyingChildren) || 0,
          }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: async (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-day'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setModalOpen(false)
      toast.success(editBooking ? 'Booking updated' : 'Booking created')

      /* Scans taken before the booking existed can only be filed now that it
         has an id. The booking itself is already saved, so a failure here is
         reported without rolling anything back. */
      const savedId = result?.data?.id || editBooking?.id
      const scans = pendingScans
      if (savedId && scans.length > 0) {
        setPendingScans([])
        const settled = await Promise.allSettled(scans.map(s => uploadScan(savedId, s)))
        const failed = settled.filter(r => r.status === 'rejected').length
        const saved  = settled.length - failed
        if (saved > 0)  toast.success(`${saved} scan${saved !== 1 ? 's' : ''} saved to Documents`)
        if (failed > 0) toast.error(`${failed} scan${failed !== 1 ? 's' : ''} could not be saved to Documents`)
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-day'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      toast.success('Booking deleted')
    },
    onError: () => toast.error('Delete failed'),
  })

  const hotelEyeStatusMutation = useMutation({
    mutationFn: async ({ id, hotelEyeStatus }: { id: string; hotelEyeStatus: string }) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelEyeStatus }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      // the today-filed counter is derived from this
      queryClient.invalidateQueries({ queryKey: ['hotel-eye'] })
      toast.success('Hotel Eye status updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-day'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      toast.success('Status updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const amountMutation = useMutation({
    mutationFn: async ({ id, paidAmount }: { id: string; paidAmount: number }) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setEditingAmountId(null)
      toast.success('Paid amount updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function saveAmount(id: string) {
    const val = parseFloat(editingAmountValue)
    if (isNaN(val) || val < 0) { toast.error('Enter a valid amount'); return }
    amountMutation.mutate({ id, paidAmount: val })
  }

  /* Copies the profile onto the booking rather than only linking it. The
     Hotel Eye payload and every existing list read the booking's own columns,
     and a filed entry must keep showing what was filed even if the profile is
     edited or deleted afterwards. */
  function applyGuest(g: Guest) {
    setForm(f => ({
      ...f,
      guestId:         g.id,
      guestName:       g.name            || f.guestName,
      guestEmail:      g.email           || f.guestEmail,
      guestPhone:      g.phone           || f.guestPhone,
      guestCnic:       g.cnic            || f.guestCnic,
      guestFatherName: g.fatherName      || f.guestFatherName,
      guestGender:     g.gender          || f.guestGender,
      guestAddress:    g.address         || f.guestAddress,
      guestProvince:   g.province        || f.guestProvince,
      guestDistrict:   g.district        || f.guestDistrict,
      passportNumber:  g.passportNumber  || f.passportNumber,
      nationality:     g.nationality     || f.nationality,
      passportExpiry:  g.passportExpiry  || f.passportExpiry,
    }))
    toast.success(`${g.name} linked to this booking`)
  }

  async function pushToHotelEye(b: Booking) {
    /* A stay that is already on the portal must not be filed twice — a duplicate
       watch entry for one guest is a correction the operator has to go and undo.
       Confirm before doing anything: the guard has to cover the direct-tool path
       too, and that one never reaches the server. Blocking here keeps the click
       gesture, so the window.open below still isn't treated as a popup. */
    const filed = getFilingStatus(b)
    let refiling = false
    if (filed.state === 'FILED') {
      const when = b.hotelEyeFiledAt ? formatDate(b.hotelEyeFiledAt, 'MMM d, h:mm a') : 'already'
      if (!confirm(`This guest was filed on Hotel Eye (${when}). File again anyway?`)) return
      refiling = true
    }

    // Open the portal immediately (must be synchronous with the click for popup blockers)
    window.open('https://hoteleye.punjab.gov.pk/hotel/addwatchentries', '_blank', 'noopener')

    // Copy the CNIC so it can be pasted straight into the portal form
    if (b.guestCnic) {
      try {
        await navigator.clipboard.writeText(b.guestCnic)
        toast.success(`Hotel Eye opened — CNIC ${b.guestCnic} copied to clipboard`, { duration: 5000 })
      } catch {
        toast.success('Hotel Eye opened in a new tab')
      }
    } else {
      toast('Hotel Eye opened — this booking has no CNIC saved yet', { icon: 'ℹ️', duration: 5000 })
    }

    // Also hand the job to the local auto-fill tool if it happens to be running (best effort)
    const payload = {
      bookingId:        b.id,
      cnic:             (b as any).guestCnic             || '',
      name:             b.guestName,
      father_name:      (b as any).guestFatherName       || '',
      gender:           (b as any).guestGender           || '',
      address:          (b as any).guestAddress          || '',
      phone:            (b as any).guestPhone            || '',
      province:         (b as any).guestProvince         || '',
      district:         (b as any).guestDistrict         || '',
      temp_address:     (b as any).tempAddress           || '',
      temp_province:    (b as any).tempProvince          || '',
      temp_district:    (b as any).tempDistrict          || '',
      check_in:         b.checkIn,
      check_out:        b.checkOut,
      room:             (b as any).roomNumber            || b.property?.name || '',
      purpose:          (b as any).purposeOfVisit        || '',
      male:             (b as any).accompanyingMale      || 0,
      female:           (b as any).accompanyingFemale    || 0,
      children:         (b as any).accompanyingChildren  || 0,
      ref_name:         (b as any).refName               || '',
      ref_father_name:  (b as any).refFatherName         || '',
      ref_business:     (b as any).refBusiness           || '',
      ref_address:      (b as any).refAddress            || '',
      ref_cell:         (b as any).refCell               || '',
      ref_verified:     (b as any).refVerified ? 'Yes' : '',
    }
    // If the local auto-fill tool is running on this PC it opens its own info
    // window immediately. If not reachable, queue the job server-side so the
    // tool's poller picks it up (and opens the window) once it's back online —
    // otherwise the info window silently never appears with no way to retry.
    try {
      const direct = await fetch('http://localhost:5000/fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2000),
      })
      if (!direct.ok) throw new Error('tool responded with an error')
    } catch {
      try {
        const res = await fetch('/api/hotel-eye/fill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The server refuses to re-queue a filed booking unless told to
          body: JSON.stringify({ ...payload, force: refiling }),
        })
        if (!res.ok) throw new Error()
        const out = await res.json()
        // Nothing was queued, so don't promise an info window that won't open
        if (out.alreadyFiled) {
          toast('Already filed on Hotel Eye — nothing queued.', { icon: 'ℹ️', duration: 5000 })
        } else {
          toast('Hotel Eye tool is offline on this PC — info window queued, it will open once the tool is running (start it with run.bat).', {
            icon: '⏳',
            duration: 7000,
          })
        }
      } catch {
        // Queueing also failed — the portal tab is still open as the primary flow
      }
    }
  }

  function openCreate() {
    setEditBooking(null)
    setForm(EMPTY_FORM)
    setUploadedDocs([])
    setPendingScans([])
    setSectionOpen({ misc: false, reminder: false, hotelEye: false, reference: false })
    setModalOpen(true)
  }
  function openCopy(b: Booking) {
    setEditBooking(null)
    const custom = b.platform === 'OTHER'
      ? splitPlatformLabel(b.notes || '')
      : { label: '', rest: b.notes || '' }
    setForm({
      guestName: b.guestName, guestEmail: b.guestEmail || '', guestPhone: b.guestPhone || '',
      checkIn: '', checkOut: '',
      rate: String(b.rate), cleaningFee: String(b.cleaningFee), platformFee: String(b.platformFee),
      platform: b.platform, status: 'CONFIRMED', propertyId: b.propertyId,
      notes: custom.rest, platformOther: custom.label,
      miscCharges: String((b as any).miscCharges || ''), miscDescription: (b as any).miscDescription || '',
      reminderAt: '', reminderNote: '', paidAmount: '',
      // a repeat stay by the same person keeps the profile link
      guestId: (b as any).guestId || '',
      guestCnic: (b as any).guestCnic || '', guestFatherName: (b as any).guestFatherName || '',
      guestGender: (b as any).guestGender || '', guestAddress: (b as any).guestAddress || '',
      passportNumber: (b as any).passportNumber || '', nationality: (b as any).nationality || '',
      passportExpiry: (b as any).passportExpiry || '',
      guestProvince: (b as any).guestProvince || '', guestDistrict: (b as any).guestDistrict || '',
      tempAddress: (b as any).tempAddress || '', tempProvince: (b as any).tempProvince || '',
      tempDistrict: (b as any).tempDistrict || '', purposeOfVisit: (b as any).purposeOfVisit || '',
      accompanyingMale: String((b as any).accompanyingMale || 0),
      accompanyingFemale: String((b as any).accompanyingFemale || 0),
      accompanyingChildren: String((b as any).accompanyingChildren || 0),
      roomNumber: (b as any).roomNumber || '',
      refName: (b as any).refName || '', refFatherName: (b as any).refFatherName || '',
      refBusiness: (b as any).refBusiness || '', refAddress: (b as any).refAddress || '',
      refCell: (b as any).refCell || '', refVerified: (b as any).refVerified || false,
    })
    setUploadedDocs([])
    setPendingScans([])
    setSectionOpen({
      misc: !!((b as any).miscCharges || (b as any).miscDescription),
      reminder: false,
      hotelEye: !!((b as any).guestCnic || (b as any).guestFatherName || (b as any).passportNumber),
      reference: !!((b as any).refName),
    })
    setModalOpen(true)
  }
  function openEdit(b: Booking) {
    setEditBooking(b)
    const custom = b.platform === 'OTHER'
      ? splitPlatformLabel(b.notes || '')
      : { label: '', rest: b.notes || '' }
    setForm({
      guestName: b.guestName, guestEmail: b.guestEmail || '', guestPhone: b.guestPhone || '',
      checkIn: toLocalInput(b.checkIn), checkOut: toLocalInput(b.checkOut),
      rate: String(b.rate), cleaningFee: String(b.cleaningFee), platformFee: String(b.platformFee),
      platform: b.platform, status: b.status, propertyId: b.propertyId, notes: custom.rest,
      platformOther: custom.label, miscCharges: String((b as any).miscCharges || ''),
      miscDescription: (b as any).miscDescription || '',
      reminderAt: toLocalInput((b as any).reminderAt || ''),
      reminderNote: (b as any).reminderNote || '',
      paidAmount: String(b.paidAmount ?? 0),
      guestId: (b as any).guestId || '',
      guestCnic: (b as any).guestCnic || '', guestFatherName: (b as any).guestFatherName || '',
      guestGender: (b as any).guestGender || '', guestAddress: (b as any).guestAddress || '',
      passportNumber: (b as any).passportNumber || '', nationality: (b as any).nationality || '',
      passportExpiry: (b as any).passportExpiry || '',
      guestProvince: (b as any).guestProvince || '', guestDistrict: (b as any).guestDistrict || '',
      tempAddress: (b as any).tempAddress || '', tempProvince: (b as any).tempProvince || '',
      tempDistrict: (b as any).tempDistrict || '', purposeOfVisit: (b as any).purposeOfVisit || '',
      accompanyingMale: String((b as any).accompanyingMale || 0),
      accompanyingFemale: String((b as any).accompanyingFemale || 0),
      accompanyingChildren: String((b as any).accompanyingChildren || 0),
      roomNumber: (b as any).roomNumber || '',
      refName: (b as any).refName || '', refFatherName: (b as any).refFatherName || '',
      refBusiness: (b as any).refBusiness || '', refAddress: (b as any).refAddress || '',
      refCell: (b as any).refCell || '', refVerified: (b as any).refVerified || false,
    })
    setSectionOpen({
      misc: !!((b as any).miscCharges || (b as any).miscDescription),
      reminder: !!((b as any).reminderAt || (b as any).reminderNote),
      hotelEye: !!((b as any).guestCnic || (b as any).guestFatherName || (b as any).passportNumber),
      reference: !!((b as any).refName),
    })
    // Load existing documents for this booking
    setPendingScans([])
    fetch(`/api/bookings/${b.id}/documents`)
      .then(r => r.json())
      .then(d => setUploadedDocs(d.data || []))
      .catch(() => {})
    setModalOpen(true)
  }

  /* Documents cap at 5MB while the scanners accept 10MB, so a large scan can
     read fine and still be too big to file. */
  const MAX_DOC_SIZE = 5 * 1024 * 1024

  async function uploadScan(bookingId: string, scan: ScannedImage): Promise<UploadedDoc> {
    const type = scan.file.type || 'image/jpeg'
    const ext  = type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    // ASCII only — the filename is echoed back in a Content-Disposition header
    const name = `${scan.label} ${new Date().toISOString().slice(0, 10)}.${ext}`

    const fd = new FormData()
    fd.append('file', new File([scan.file], name, { type }))
    const res = await fetch(`/api/bookings/${bookingId}/documents`, { method: 'POST', body: fd })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error || 'Could not save scan to Documents')
    }
    const { data } = await res.json()
    return data
  }

  /* Every scan is filed against the booking so the original image stays
     available after the extracted text has been edited. */
  async function attachScan(scan: ScannedImage) {
    if (scan.file.size > MAX_DOC_SIZE) {
      toast('Scan read, but the image is over 5MB so it was not saved to Documents.', { icon: 'ℹ️' })
      return
    }
    if (!editBooking) {
      // Replace any earlier scan of the same side rather than queueing both
      setPendingScans(prev => [...prev.filter(p => p.label !== scan.label), scan])
      return
    }
    try {
      const doc = await uploadScan(editBooking.id, scan)
      setUploadedDocs(prev => [doc, ...prev])
      toast.success(`${scan.label} saved to Documents`)
    } catch (err: any) {
      toast.error(err.message || 'Could not save scan to Documents')
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, bookingId?: string) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large. Max 5MB.'); return }
    if (!bookingId) { toast('Save the booking first, then upload documents.', { icon: 'ℹ️' }); return }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/documents`, { method: 'POST', body: fd })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const { data } = await res.json()
      setUploadedDocs(prev => [data, ...prev])
      toast.success(`Uploaded: ${file.name}`)
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function deleteDoc(bookingId: string, docId: string) {
    await fetch(`/api/bookings/${bookingId}/documents/${docId}`, { method: 'DELETE' })
    setUploadedDocs(prev => prev.filter(d => d.id !== docId))
    toast.success('Document removed')
  }

  async function exportToExcel() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(bookings.map((b) => ({
      Guest: b.guestName, Email: b.guestEmail, 'Check-in': formatDate(b.checkIn),
      'Check-out': formatDate(b.checkOut), Nights: b.nights, 'Rate/Night': b.rate,
      Total: b.totalAmount, Paid: b.paidAmount ?? 0, Outstanding: b.totalAmount - (b.paidAmount ?? 0),
      'Payment Status': PAYMENT_STATUS_META[getPaymentStatus(b.totalAmount, b.paidAmount)].label,
      Net: b.netAmount, Platform: b.platform, Status: b.status,
      Property: b.property?.name,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings')
    XLSX.writeFile(wb, 'bookings.xlsx')
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={view === 'hoteleye' ? 'Hotel Eye Bookings' : 'All Bookings'}
        description={
          view === 'hoteleye'
            ? `${total} stay${total === 1 ? '' : 's'} with a card on file`
            : `${total} total booking${total === 1 ? '' : 's'}`
        }
      >
        <Button variant="outline" size="sm" className={HERO_CONTROL} onClick={exportToExcel}><Download className="h-4 w-4" />Export page</Button>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />New Booking</Button>
      </PageHero>

      {/* Hotel Eye compliance — today's filing position at a glance */}
      {compliance && (compliance.arrivalsToday > 0 || compliance.overdue > 0 || compliance.failed > 0) && (
        <button
          type="button"
          onClick={() => { setHotelEyeFilter(compliance.overdue > 0 ? 'OVERDUE' : compliance.failed > 0 ? 'FAILED' : 'NOT_ENTERED'); setPage(1) }}
          className={cn(
            'flex w-full flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
            compliance.overdue > 0 || compliance.failed > 0
              ? 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/15'
              : compliance.clear
                ? 'border-green-600/40 bg-green-500/10 hover:bg-green-500/15'
                : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15'
          )}
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Hotel Eye today</span>
          <span className="font-semibold tabular-nums">
            {compliance.filedToday} / {compliance.arrivalsToday} filed
          </span>
          {compliance.overdue > 0 && (
            <span className="font-semibold text-rose-500">{compliance.overdue} overdue past 24h</span>
          )}
          {compliance.failed > 0 && (
            <span className="font-semibold text-rose-500">{compliance.failed} failed</span>
          )}
          {compliance.clear && <span className="font-semibold text-green-600">All arrivals filed</span>}
        </button>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search guests..." className="pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW'].map((s) => (
              <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map((p, i) => (
              <SelectItem key={i} value={p.custom ? `OTHER:${p.label}` : p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PARTIAL">Partially Paid</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={hotelEyeFilter} onValueChange={(v) => { setHotelEyeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Hotel Eye" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Hotel Eye</SelectItem>
            <SelectItem value="OVERDUE">Overdue (24h+)</SelectItem>
            <SelectItem value="FAILED">Filing failed</SelectItem>
            <SelectItem value="NOT_ENTERED">Not filed</SelectItem>
            <SelectItem value="QUEUED">Filing…</SelectItem>
            <SelectItem value="ENTERED">Filed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">Sort by:</span>
        {[
          { field: 'checkIn',     label: 'Check-in' },
          { field: 'guestName',   label: 'Guest' },
          { field: 'totalAmount', label: 'Amount' },
          { field: 'nights',      label: 'Nights' },
          { field: 'status',      label: 'Status' },
          { field: 'platform', label: 'Platform' },
        ].map(({ field, label }) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors',
              sortBy === field
                ? 'bg-primary text-primary-foreground border-primary font-semibold'
                : 'hover:bg-accent border-border'
            )}
          >
            {label}
            {sortBy === field && (
              <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
        <button
          onClick={() => { setHotelEyeFilter(f => f === 'ENTERED' ? 'all' : 'ENTERED'); setPage(1) }}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors',
            hotelEyeFilter === 'ENTERED'
              ? 'bg-green-600 text-white border-green-600 font-semibold'
              : 'hover:bg-accent border-border'
          )}
        >
          HE: Filed
        </button>
      </div>

      {/* Grouped bookings list */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-60" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </Card>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarDays}
              title={search || statusFilter !== 'all' || platformFilter !== 'all' || paymentFilter !== 'all' ? 'No bookings match these filters' : 'No bookings yet'}
              description={search || statusFilter !== 'all' || platformFilter !== 'all' || paymentFilter !== 'all' ? 'Try clearing the search or filters.' : 'Log your first guest to see them here.'}
              action={{ label: 'New Booking', onClick: openCreate }}
            />
          </Card>
        ) : (
          groupedBookings.map((group) => (
            <div key={group.dateKey} className="space-y-2">
              {/* Date section header (hidden for the flat non-date-sorted group) */}
              {group.label && <div className="flex items-center gap-3 px-1">
                <div className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shrink-0',
                  group.label.startsWith('Today')
                    ? 'bg-blue-500 text-white'
                    : group.label.startsWith('Tomorrow')
                      ? 'bg-green-500 text-white'
                      : group.label.startsWith('Yesterday')
                        ? 'bg-amber-500 text-white'
                        : 'bg-muted text-muted-foreground border'
                )}>
                  <CalendarDays className="h-3 w-3" />
                  {group.label}
                </div>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground shrink-0">
                  {group.bookings.length} {group.bookings.length === 1 ? 'booking' : 'bookings'}
                </span>
              </div>}

              {/* Booking cards */}
              <div className="space-y-2">
                <AnimatePresence initial={true}>
                {group.bookings.map((b, idx) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: shouldReduceMotion ? 0.01 : 0.18 } }}
                    transition={{ duration: shouldReduceMotion ? 0.01 : 0.2, delay: shouldReduceMotion ? 0 : idx * 0.04 }}
                  >
                    <Card className="relative overflow-hidden hover:shadow-md transition-shadow group">
                      {/* Status left accent */}
                      <div className={cn(
                        'absolute left-0 top-0 bottom-0 w-[3px]',
                        b.status === 'CONFIRMED'   ? 'bg-blue-500' :
                        b.status === 'CHECKED_IN'  ? 'bg-green-500' :
                        b.status === 'CHECKED_OUT' ? 'bg-purple-500' :
                        b.status === 'PENDING'     ? 'bg-amber-500' :
                        b.status === 'CANCELLED'   ? 'bg-red-400' : 'bg-muted-foreground'
                      )} />

                      <div className="flex items-center gap-3 pl-5 pr-4 py-3 flex-wrap sm:flex-nowrap">
                        {/* Avatar */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold ring-2 ring-primary/10">
                          {b.guestName?.[0]?.toUpperCase() ?? '?'}
                        </div>

                        {/* Guest + property */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{b.guestName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {b.property?.name}
                            {b.guestEmail && <> · {b.guestEmail}</>}
                          </p>
                          {/* Mobile-only check-in/out with time */}
                          <div className="flex sm:hidden items-center gap-1.5 mt-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                            <span className="font-medium text-foreground">{formatDate(b.checkIn, 'MMM d, h:mm a')}</span>
                            <span>→</span>
                            <span className="font-medium text-foreground">{formatDate(b.checkOut, 'MMM d, h:mm a')}</span>
                            <span className="text-muted-foreground/60">· {b.nights}n</span>
                          </div>
                        </div>

                        {/* Date range */}
                        <div className="hidden sm:flex flex-col gap-0.5 text-xs whitespace-nowrap shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">{formatDate(b.checkIn, 'MMM d')}</span>
                            <span className="text-muted-foreground/60">{formatDate(b.checkIn, 'h:mm a')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">{formatDate(b.checkOut, 'MMM d')}</span>
                            <span className="text-muted-foreground/60">{formatDate(b.checkOut, 'h:mm a')}</span>
                            <span className="text-muted-foreground/50 ml-1">· {b.nights}n</span>
                          </div>
                        </div>

                        {/* Platform */}
                        <div className="hidden md:block shrink-0">
                          <Badge className={getPlatformColor(b.platform)} variant="outline">
                            {(() => {
                              const notes = b.notes || ''
                              if (b.platform === 'OTHER') {
                                const m = notes.match(/^\[([^\]]+)\]/)
                                if (m) return m[1]
                                const custom = platforms.find(p => p.custom && p.value === 'OTHER')
                                return custom?.label ?? 'Other'
                              }
                              return platforms.find(p => p.value === b.platform)?.label
                                ?? (b.platform === 'BOOKING_COM' ? 'Booking.com' : b.platform.charAt(0) + b.platform.slice(1).toLowerCase())
                            })()}
                          </Badge>
                        </div>

                        {/* Hotel Eye filing — state and remaining 24h window */}
                        <div className="hidden md:block shrink-0">
                          {(() => {
                            const fs = getFilingStatus(b)
                            const meta = FILING_STATE_META[fs.state]
                            const title =
                              fs.state === 'FAILED'
                                ? `Filing failed: ${b.hotelEyeError || 'reason not recorded'}`
                                : fs.state === 'FILED'
                                  ? b.hotelEyeFiledAt
                                    ? `Filed ${formatDate(b.hotelEyeFiledAt, 'MMM d, h:mm a')}`
                                    : 'Filed (time not recorded)'
                                  : `Must be filed by ${formatDate(fs.deadline, 'MMM d, h:mm a')}`
                            return (
                              <Select
                                value={b.hotelEyeStatus === 'ENTERED' ? 'ENTERED' : 'NOT_ENTERED'}
                                onValueChange={(s) => hotelEyeStatusMutation.mutate({ id: b.id, hotelEyeStatus: s })}
                              >
                                <SelectTrigger
                                  title={title}
                                  className={cn('h-6 w-[124px] text-[10px] px-2 rounded-full border gap-1', meta.className)}
                                >
                                  <span className="truncate">{fs.label}</span>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NOT_ENTERED">Not filed</SelectItem>
                                  <SelectItem value="ENTERED">Filed</SelectItem>
                                </SelectContent>
                              </Select>
                            )
                          })()}
                        </div>

                        {/* Payment status — derived from the amounts, not stored */}
                        <div className="shrink-0">
                          {(() => {
                            const meta = PAYMENT_STATUS_META[getPaymentStatus(b.totalAmount, b.paidAmount)]
                            return (
                              <Badge variant="outline" className={cn('h-6 rounded-full px-2 text-[10px] font-semibold whitespace-nowrap', meta.className)}>
                                {meta.label}
                              </Badge>
                            )
                          })()}
                        </div>

                        {/* Status selector */}
                        <div className="shrink-0">
                          <Select
                            value={b.status}
                            onValueChange={(s) => statusMutation.mutate({ id: b.id, status: s })}
                          >
                            <SelectTrigger className={`h-7 w-[128px] text-xs border px-2 ${getStatusColor(b.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                { value: 'PENDING',     label: 'Pending' },
                                { value: 'CONFIRMED',   label: 'Confirmed' },
                                { value: 'CHECKED_IN',  label: 'Checked in' },
                                { value: 'CHECKED_OUT', label: 'Checked out' },
                                { value: 'CANCELLED',   label: 'Cancelled' },
                                { value: 'NO_SHOW',     label: 'No show' },
                              ].map(({ value, label }) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Amount */}
                        <div className="shrink-0 min-w-[80px] text-right">
                          {editingAmountId === b.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number" min="0"
                                value={editingAmountValue}
                                onChange={(e) => setEditingAmountValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveAmount(b.id)
                                  if (e.key === 'Escape') setEditingAmountId(null)
                                }}
                                className="h-7 w-20 text-xs text-right"
                                autoFocus
                              />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600"
                                onClick={() => saveAmount(b.id)} disabled={amountMutation.isPending}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                                onClick={() => setEditingAmountId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <button
                                className="font-bold text-sm tabular-nums hover:text-primary hover:underline underline-offset-2 transition-colors"
                                title="Click to edit paid amount" aria-label="Click to edit paid amount"
                                onClick={() => { setEditingAmountId(b.id); setEditingAmountValue(String(b.paidAmount ?? 0)) }}
                              >
                                {format(b.paidAmount ?? 0)}
                              </button>
                              {(b.totalAmount - (b.paidAmount ?? 0)) > 0 && (
                                <span className="text-[10px] text-amber-500 font-medium leading-none mt-0.5">
                                  {format(b.totalAmount - (b.paidAmount ?? 0))} owed
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 shrink-0 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:!opacity-100">
                          <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11" title="Edit" aria-label="Edit" onClick={() => openEdit(b)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 text-muted-foreground hover:text-primary" title="Duplicate" aria-label="Duplicate" onClick={() => openCopy(b)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 text-blue-500 hover:text-blue-600" title="Push to Hotel Eye" aria-label="Push to Hotel Eye" onClick={() => pushToHotelEye(b)}>
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 text-destructive hover:text-destructive" title="Delete" aria-label="Delete"
                            onClick={() => { if (confirm('Delete this booking?')) deleteMutation.mutate(b.id) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} total</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="max-w-5xl p-0 gap-0 overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="flex flex-col max-h-[92vh]">

          {/* Sticky header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <DialogTitle className="text-lg">
              {editBooking ? 'Edit Booking' : form.guestName ? `Copy — ${form.guestName}` : 'New Booking'}
            </DialogTitle>
          </DialogHeader>

          {/* Two-column body */}
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Scrollable form */}
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-6 space-y-7 md:border-r">

            {/* Guest profile picker. Scanning moved to the guest profile, so a
                repeat guest is read from their card once and reused here. */}
            <GuestPicker
              value={form.guestId}
              guestName={form.guestName}
              onPick={applyGuest}
              onClear={() => setForm(f => ({ ...f, guestId: '' }))}
            />

            {/* ── Guest Details ─────────────────────── */}
            <div className="space-y-3.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground/80">Guest Details</p>
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label>Guest Name *</Label>
                  <Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Full name" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} placeholder="guest@email.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} placeholder="+92 300 0000000" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Stay Details ──────────────────────── */}
            <div className="border-t pt-6 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground/80">Stay Details</p>

              {/* Check-in / Check-out */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label>Check-in *</Label>
                  <Input type="datetime-local" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Check-out *</Label>
                  <Input type="datetime-local" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
                </div>
              </div>

              {/* Property + Platform + Status in a row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <Label>Property *</Label>
                  <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Platform *</Label>
                  <Select
                    /* Only select an OTHER:<label> item when one actually
                       exists. Free text being typed into the box below has no
                       matching item, and handing Select an unknown value blanks
                       the trigger. */
                    value={form.platform === 'OTHER'
                      ? (platforms.some(p => p.custom && p.label === form.platformOther)
                          ? `OTHER:${form.platformOther}`
                          : 'OTHER')
                      : form.platform}
                    onValueChange={(v) => {
                      const item = platforms.find(p => (p.custom ? `OTHER:${p.label}` : p.value) === v)
                      setForm({
                        ...form,
                        platform: item?.value ?? v,
                        platformOther: item?.custom ? item.label : '',
                        platformFee: item && item.fee > 0 ? String(item.fee) : form.platformFee,
                      })
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {platforms.map((p, i) => (
                        <SelectItem key={i} value={p.custom ? `OTHER:${p.label}` : p.value}>
                          {p.label}{p.fee > 0 ? ` (${p.fee} default)` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Rendered for the whole time OTHER is selected. Gating this
                      on an empty platformOther unmounted the input on the first
                      keystroke, so only one character could ever be typed. */}
                  {form.platform === 'OTHER' && (
                    <Input value={form.platformOther} onChange={(e) => setForm({ ...form, platformOther: e.target.value })} placeholder="e.g. Facebook, Walk-in…" className="mt-2" autoFocus />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[
                        { value: 'PENDING',     label: 'Pending' },
                        { value: 'CONFIRMED',   label: 'Confirmed' },
                        { value: 'CHECKED_IN',  label: 'Checked in' },
                        { value: 'CHECKED_OUT', label: 'Checked out' },
                        { value: 'CANCELLED',   label: 'Cancelled' },
                        { value: 'NO_SHOW',     label: 'No show' },
                      ].map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Financial row: Rate / Cleaning / Platform fee */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <Label>Rate / Night ({currencyInfo.symbol}) *</Label>
                  <Input type="number" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cleaning Fee ({currencyInfo.symbol})</Label>
                  <Input type="number" min="0" value={form.cleaningFee} onChange={(e) => setForm({ ...form, cleaningFee: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Platform Fee ({currencyInfo.symbol})</Label>
                  <Input type="number" min="0" value={form.platformFee} onChange={(e) => setForm({ ...form, platformFee: e.target.value })} />
                </div>
              </div>

              {/* Paid + Outstanding */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label>Paid Amount ({currencyInfo.symbol})</Label>
                  <Input type="number" min="0" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Outstanding ({currencyInfo.symbol})</Label>
                  {(() => {
                    const nights = form.checkIn && form.checkOut
                      ? Math.max(1, Math.ceil((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000))
                      : 0
                    const total = (Number(form.rate) || 0) * nights + (Number(form.cleaningFee) || 0) + (Number(form.miscCharges) || 0)
                    const outstanding = Math.max(0, total - (Number(form.paidAmount) || 0))
                    return (
                      <div className={cn(
                        'flex h-9 items-center rounded-md border px-3 text-sm font-medium',
                        outstanding > 0 ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400'
                      )}>
                        {outstanding > 0 ? `${currencyInfo.symbol} ${outstanding.toLocaleString()}` : 'Fully paid ✓'}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* ── Miscellaneous Charges (collapsible) ─── */}
            <div className={cn('rounded-xl border transition-colors', sectionOpen.misc ? 'bg-muted/20' : 'bg-transparent')}>
              <button type="button" onClick={() => toggleSection('misc')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground/80">
                  Miscellaneous Charges
                  {!sectionOpen.misc && (form.miscCharges || form.miscDescription) && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', sectionOpen.misc && 'rotate-180')} />
              </button>
              <SectionBody open={sectionOpen.misc}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-4 pb-4">
                  <div className="space-y-1.5">
                    <Label>Misc Charges ({currencyInfo.symbol})</Label>
                    <Input type="number" min="0" value={form.miscCharges} onChange={(e) => setForm({ ...form, miscCharges: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input value={form.miscDescription} onChange={(e) => setForm({ ...form, miscDescription: e.target.value })} placeholder="e.g. Late checkout fee…" />
                  </div>
                </div>
              </SectionBody>
            </div>

            {/* ── Reminder (collapsible) ──────────────── */}
            <div className={cn('rounded-xl border transition-colors', sectionOpen.reminder ? 'bg-muted/20' : 'bg-transparent')}>
              <button type="button" onClick={() => toggleSection('reminder')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground/80">
                  <Bell className="h-3.5 w-3.5" /> Reminder
                  {!sectionOpen.reminder && (form.reminderAt || form.reminderNote) && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', sectionOpen.reminder && 'rotate-180')} />
              </button>
              <SectionBody open={sectionOpen.reminder}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-4 pb-4">
                  <div className="space-y-1.5">
                    <Label>Remind At</Label>
                    <Input type="datetime-local" value={form.reminderAt} onChange={(e) => setForm({ ...form, reminderAt: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note</Label>
                    <Input value={form.reminderNote} onChange={(e) => setForm({ ...form, reminderNote: e.target.value })} placeholder="e.g. Call guest before check-in" />
                  </div>
                </div>
              </SectionBody>
            </div>

            {/* ── Hotel Eye / Guest Identity (collapsible) */}
            <div className={cn('rounded-xl border transition-colors', sectionOpen.hotelEye ? 'bg-muted/20' : 'bg-transparent')}>
              <button type="button" onClick={() => toggleSection('hotelEye')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground/80">
                  <ScanLine className="h-3.5 w-3.5" /> Hotel Eye / Guest Identity
                  {!sectionOpen.hotelEye && (form.guestCnic || form.guestFatherName) && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', sectionOpen.hotelEye && 'rotate-180')} />
              </button>
              <SectionBody open={sectionOpen.hotelEye}>
                <div className="space-y-4 px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>CNIC #</Label>
                      <Input value={form.guestCnic} onChange={(e) => setForm({ ...form, guestCnic: e.target.value })} placeholder="12345-1234567-1" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Gender</Label>
                      <select value={form.guestGender} onChange={(e) => setForm({ ...form, guestGender: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value="">— Select —</option>
                        <option>Male</option>
                        <option>Female</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <Label>Passport #</Label>
                      <Input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} placeholder="e.g. AB1234567" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nationality</Label>
                      <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="e.g. British" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Passport Expiry</Label>
                      <Input type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Father Name</Label>
                    <Input value={form.guestFatherName} onChange={(e) => setForm({ ...form, guestFatherName: e.target.value })} placeholder="Father's full name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Permanent Address</Label>
                    <Input value={form.guestAddress} onChange={(e) => setForm({ ...form, guestAddress: e.target.value })} placeholder="As on CNIC" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Province</Label>
                      <Input value={form.guestProvince} onChange={(e) => setForm({ ...form, guestProvince: e.target.value })} placeholder="e.g. Punjab" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>District</Label>
                      <Input value={form.guestDistrict} onChange={(e) => setForm({ ...form, guestDistrict: e.target.value })} placeholder="e.g. Lahore" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Temporary Address (at property)</Label>
                    <Input value={form.tempAddress} onChange={(e) => setForm({ ...form, tempAddress: e.target.value })} placeholder="Hotel / property address" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Temp Province</Label>
                      <Input value={form.tempProvince} onChange={(e) => setForm({ ...form, tempProvince: e.target.value })} placeholder="e.g. KPK" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Temp District</Label>
                      <Input value={form.tempDistrict} onChange={(e) => setForm({ ...form, tempDistrict: e.target.value })} placeholder="e.g. Peshawar" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <Label>Room #</Label>
                      <Input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="101" />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Purpose of Visit</Label>
                      <Input value={form.purposeOfVisit} onChange={(e) => setForm({ ...form, purposeOfVisit: e.target.value })} placeholder="Tourism, Business…" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Accompanying Guests</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Male',     key: 'accompanyingMale' },
                        { label: 'Female',   key: 'accompanyingFemale' },
                        { label: 'Children', key: 'accompanyingChildren' },
                      ].map(({ label, key }) => (
                        <div key={key} className="space-y-1">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <Input type="number" min="0" value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionBody>
            </div>

            {/* ── Local Reference / Dealer (collapsible) */}
            <div className={cn('rounded-xl border transition-colors', sectionOpen.reference ? 'bg-muted/20' : 'bg-transparent')}>
              <button type="button" onClick={() => toggleSection('reference')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground/80">
                  Local Reference / Dealer
                  {!sectionOpen.reference && form.refName && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', sectionOpen.reference && 'rotate-180')} />
              </button>
              <SectionBody open={sectionOpen.reference}>
                <div className="space-y-3 px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input value={form.refName} onChange={(e) => setForm({ ...form, refName: e.target.value })} placeholder="Reference name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Father Name</Label>
                      <Input value={form.refFatherName} onChange={(e) => setForm({ ...form, refFatherName: e.target.value })} placeholder="Father's name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Business</Label>
                      <Input value={form.refBusiness} onChange={(e) => setForm({ ...form, refBusiness: e.target.value })} placeholder="Business name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cell #</Label>
                      <Input value={form.refCell} onChange={(e) => setForm({ ...form, refCell: e.target.value })} placeholder="+92 300 0000000" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address</Label>
                    <Input value={form.refAddress} onChange={(e) => setForm({ ...form, refAddress: e.target.value })} placeholder="Reference address" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="refVerified" checked={!!form.refVerified} onChange={(e) => setForm({ ...form, refVerified: e.target.checked })} className="h-4 w-4 rounded border-input" />
                    <label htmlFor="refVerified" className="text-sm cursor-pointer">Reference Verified</label>
                  </div>
                </div>
              </SectionBody>
            </div>

            {/* ── Notes ─────────────────────────────── */}
            <div className="border-t pt-6 space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this booking" />
            </div>

            {/* ── Documents ─────────────────────────── */}
            <div className="border-t pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground/80 mb-3">Documents</p>
              {editBooking ? (
                <div className="space-y-3">
                  <label className={`flex items-center gap-2 cursor-pointer w-fit rounded-lg border border-dashed px-4 py-2.5 text-sm transition-colors ${uploading ? 'opacity-50 pointer-events-none' : 'hover:bg-accent'}`}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-muted-foreground">{uploading ? 'Uploading…' : 'Upload file'}</span>
                    <span className="text-xs text-muted-foreground/60">PDF, DOC, XLS, Image (max 5MB)</span>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt" onChange={(e) => handleFileUpload(e, editBooking.id)} disabled={uploading} />
                  </label>
                  {uploadedDocs.length > 0 && (
                    <div className="space-y-2">
                      {uploadedDocs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB</p>
                          </div>
                          {VIEWABLE_TYPES.has(doc.mimeType) && (
                            <a href={`/api/bookings/${editBooking.id}/documents/${doc.id}?inline=1`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">View</a>
                          )}
                          <a href={`/api/bookings/${editBooking.id}/documents/${doc.id}`} target="_blank" className="text-xs text-primary hover:underline shrink-0">Download</a>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => deleteDoc(editBooking.id, doc.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : pendingScans.length > 0 ? (
                /* Scans captured before the booking exists — filed on save */
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {pendingScans.length} scan{pendingScans.length !== 1 ? 's' : ''} will be attached when you save this booking.
                  </p>
                  {pendingScans.map(scan => (
                    <div key={scan.label} className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{scan.label}</p>
                        <p className="text-xs text-muted-foreground">{(scan.file.size / 1024).toFixed(1)} KB · pending save</p>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => setPendingScans(prev => prev.filter(p => p.label !== scan.label))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Save the booking first to <span className="text-primary">upload documents</span>. Anything you scan is attached automatically.
                </p>
              )}
            </div>
          </div>{/* end scrollable form */}

          {/* ── Right summary panel ───────────────────── */}
          <div className="w-full md:w-[270px] shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l md:border-border/50 px-4 py-5 space-y-4 text-sm max-h-48 md:max-h-none">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Booking Summary</p>

            {/* Nights + totals - always visible */}
            {(() => {
              const nights = form.checkIn && form.checkOut
                ? Math.max(1, Math.ceil((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000))
                : 0
              const total = (Number(form.rate)||0)*nights + (Number(form.cleaningFee)||0) + (Number(form.miscCharges)||0)
              const outstanding = Math.max(0, total - (Number(form.paidAmount)||0))
              return (
                <div className="space-y-1.5 pb-4 border-b border-border/50">
                  {nights > 0 && <SumRow label="Nights" value={String(nights)} />}
                  {total > 0  && <SumRow label="Total"  value={format(total)} />}
                  {(Number(form.paidAmount)||0) > 0 && <SumRow label="Paid" value={format(Number(form.paidAmount))} />}
                  {outstanding > 0
                    ? <SumRow label="Outstanding" value={format(outstanding)} cls="text-amber-500 font-semibold" />
                    : total > 0 ? <SumRow label="Outstanding" value="Fully paid ✓" cls="text-green-600 font-semibold" /> : null}
                </div>
              )
            })()}

            {/* Guest */}
            <SumSection title="Guest" aria-label="Guest">
              <SumRow label="Name"    value={form.guestName} />
              <SumRow label="Email"   value={form.guestEmail} />
              <SumRow label="Phone"   value={form.guestPhone} />
            </SumSection>

            {/* Stay */}
            <SumSection title="Stay" aria-label="Stay">
              <SumRow label="Check-in"  value={form.checkIn  ? fnsFormat(new Date(form.checkIn),  'MMM d yyyy, HH:mm') : ''} />
              <SumRow label="Check-out" value={form.checkOut ? fnsFormat(new Date(form.checkOut), 'MMM d yyyy, HH:mm') : ''} />
              <SumRow label="Property"  value={properties.find((p: any) => p.id === form.propertyId)?.name ?? ''} />
              <SumRow label="Platform"  value={form.platformOther || platforms.find(p => p.value === form.platform)?.label || form.platform} />
              <SumRow label="Status"    value={form.status} />
            </SumSection>

            {/* Financials */}
            <SumSection title="Financials" aria-label="Financials">
              <SumRow label="Rate/night"    value={form.rate       ? `${currencyInfo.symbol} ${form.rate}`       : ''} />
              <SumRow label="Cleaning fee"  value={form.cleaningFee? `${currencyInfo.symbol} ${form.cleaningFee}`: ''} />
              <SumRow label="Platform fee"  value={form.platformFee? `${currencyInfo.symbol} ${form.platformFee}`: ''} />
              <SumRow label="Misc charges"  value={form.miscCharges? `${currencyInfo.symbol} ${form.miscCharges}`: ''} />
              {form.miscDescription && <SumRow label="Misc note" value={form.miscDescription} />}
            </SumSection>

            {/* Hotel Eye */}
            {(form.guestCnic || form.guestFatherName || form.guestAddress || form.purposeOfVisit || form.passportNumber) && (
              <SumSection title="Hotel Eye / Identity" aria-label="Hotel Eye / Identity">
                <SumRow label="CNIC"          value={form.guestCnic} />
                <SumRow label="Passport #"    value={form.passportNumber} />
                <SumRow label="Nationality"   value={form.nationality} />
                <SumRow label="Passport Exp." value={form.passportExpiry} />
                <SumRow label="Father"        value={form.guestFatherName} />
                <SumRow label="Gender"        value={form.guestGender} />
                <SumRow label="Address"       value={form.guestAddress} />
                <SumRow label="Province"      value={form.guestProvince} />
                <SumRow label="District"      value={form.guestDistrict} />
                <SumRow label="Temp Address"  value={form.tempAddress} />
                <SumRow label="Temp Province" value={form.tempProvince} />
                <SumRow label="Temp District" value={form.tempDistrict} />
                <SumRow label="Room #"        value={form.roomNumber} />
                <SumRow label="Purpose"       value={form.purposeOfVisit} />
                {(Number(form.accompanyingMale)||Number(form.accompanyingFemale)||Number(form.accompanyingChildren)) > 0 && (
                  <SumRow label="Guests" value={`M:${form.accompanyingMale} F:${form.accompanyingFemale} C:${form.accompanyingChildren}`} />
                )}
              </SumSection>
            )}

            {/* Reference */}
            {form.refName && (
              <SumSection title="Reference / Dealer" aria-label="Reference / Dealer">
                <SumRow label="Name"     value={form.refName} />
                <SumRow label="Father"   value={form.refFatherName} />
                <SumRow label="Business" value={form.refBusiness} />
                <SumRow label="Cell"     value={form.refCell} />
                <SumRow label="Address"  value={form.refAddress} />
                {form.refVerified && <SumRow label="Verified" value="Yes ✓" cls="text-green-600" />}
              </SumSection>
            )}

            {/* Notes & reminder */}
            {form.notes && (
              <SumSection title="Notes" aria-label="Notes">
                <p className="text-xs text-foreground break-words">{form.notes}</p>
              </SumSection>
            )}
            {form.reminderAt && (
              <SumSection title="Reminder" aria-label="Reminder">
                <SumRow label="At"   value={fnsFormat(new Date(form.reminderAt), 'MMM d yyyy, HH:mm')} />
                <SumRow label="Note" value={form.reminderNote} />
              </SumSection>
            )}
          </div>

          </div>{/* end two-column body */}

          {/* Sticky footer */}
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="ghost" className="mr-auto text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm('Clear all fields?')) setForm(EMPTY_FORM) }}>
              Clear
            </Button>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                // '' is not a guest id — send null so unlinking clears the FK
                const payload = { ...form, guestId: form.guestId || null } as typeof form & { guestId: string | null }
                const label = form.platformOther.trim()
                if (form.platform === 'OTHER' && label) {
                  /* Always bracketed, even with no notes — an unbracketed label
                     could not be parsed back out on edit or in the list. */
                  payload.notes = form.notes ? `[${label}] ${form.notes}` : `[${label}]`
                }
                saveMutation.mutate(payload)
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : editBooking ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>

          </div>{/* end inner flex wrapper */}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SumSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 pb-4 border-b border-border/50 last:border-0 last:pb-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function SectionBody({ open, children }: { open: boolean; children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SumRow({ label, value, cls }: { label: string; value?: string | number; cls?: string }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-right break-words max-w-[140px]', cls)}>{value}</span>
    </div>
  )
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsInner />
    </Suspense>
  )
}
