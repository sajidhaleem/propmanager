'use client'

import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Edit, Trash2, Upload, FileText, X, Loader2, Copy, Check, Bell, CalendarDays, Send, ScanLine, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDate, getStatusColor, getPlatformColor, cn } from '@/lib/utils'
import { isToday, isTomorrow, isYesterday, parseISO, format as fnsFormat } from 'date-fns'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking } from '@/types'
import { CnicScanner, type CnicData } from '@/components/ui/CnicScanner'
import { DEFAULT_PLATFORMS, type PlatformItem } from '@/app/dashboard/settings/page'

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
  // Hotel Eye / Guest identity
  guestCnic: '', guestFatherName: '', guestGender: '', guestAddress: '',
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

export default function BookingsPage() {
  const queryClient = useQueryClient()
  const { format, currencyInfo } = useCurrency()
  const [page, setPage] = useState(1)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [hotelEyeFilter, setHotelEyeFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null)
  const [editingAmountValue, setEditingAmountValue] = useState('')
  const [sortBy,    setSortBy]    = useState('checkIn')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [sectionOpen, setSectionOpen] = useState({ misc: false, reminder: false, hotelEye: false, reference: false })
  function toggleSection(key: keyof typeof sectionOpen) { setSectionOpen(s => ({ ...s, [key]: !s[key] })) }

  function handleSort(field: string) {
    if (field === sortBy) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('asc') }
    setPage(1)
  }

  const params: Record<string, string> = { page: String(page), limit: '15', sortBy, sortOrder }
  if (search) params.search = search
  if (statusFilter !== 'all') params.status = statusFilter
  if (platformFilter !== 'all') params.platform = platformFilter
  if (hotelEyeFilter !== 'all') params.hotelEyeStatus = hotelEyeFilter

  const { data, isLoading } = useQuery({ queryKey: ['bookings', params], queryFn: () => fetchBookings(params) })
  const { data: propertiesData } = useQuery({ queryKey: ['properties'], queryFn: fetchProperties })
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

  const groupedBookings = useMemo(() => {
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
  }, [bookings])

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
            accompanyingMale:     Number(payload.accompanyingMale)     || 0,
            accompanyingFemale:   Number(payload.accompanyingFemale)   || 0,
            accompanyingChildren: Number(payload.accompanyingChildren) || 0,
          }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
      toast.success(editBooking ? 'Booking updated' : 'Booking created')
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
      toast.success('Booking deleted')
    },
    onError: () => toast.error('Delete failed'),
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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

  function applyScannedCnic(data: CnicData) {
    setForm(f => ({
      ...f,
      guestName:      data.name        || f.guestName,
      guestFatherName: data.father_name || f.guestFatherName,
      guestCnic:      data.cnic        || f.guestCnic,
      guestGender:    data.gender      || f.guestGender,
      guestAddress:   data.address     || f.guestAddress,
    }))
  }

  async function pushToHotelEye(b: Booking) {
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
    try {
      const res = await fetch('/api/hotel-eye/fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to queue job')
      toast.success('Queued — Hotel Eye tool on your PC will open the browser shortly')
    } catch (e: any) {
      toast.error(e.message || 'Failed to queue Hotel Eye job', { duration: 5000 })
    }
  }

  function openCreate() {
    setEditBooking(null)
    setForm(EMPTY_FORM)
    setUploadedDocs([])
    setSectionOpen({ misc: false, reminder: false, hotelEye: false, reference: false })
    setModalOpen(true)
  }
  function openCopy(b: Booking) {
    setEditBooking(null)
    setForm({
      guestName: b.guestName, guestEmail: b.guestEmail || '', guestPhone: b.guestPhone || '',
      checkIn: '', checkOut: '',
      rate: String(b.rate), cleaningFee: String(b.cleaningFee), platformFee: String(b.platformFee),
      platform: b.platform, status: 'CONFIRMED', propertyId: b.propertyId,
      notes: b.notes || '', platformOther: '',
      miscCharges: String((b as any).miscCharges || ''), miscDescription: (b as any).miscDescription || '',
      reminderAt: '', reminderNote: '', paidAmount: '',
      guestCnic: (b as any).guestCnic || '', guestFatherName: (b as any).guestFatherName || '',
      guestGender: (b as any).guestGender || '', guestAddress: (b as any).guestAddress || '',
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
    setSectionOpen({
      misc: !!((b as any).miscCharges || (b as any).miscDescription),
      reminder: false,
      hotelEye: !!((b as any).guestCnic || (b as any).guestFatherName),
      reference: !!((b as any).refName),
    })
    setModalOpen(true)
  }
  function openEdit(b: Booking) {
    setEditBooking(b)
    setForm({
      guestName: b.guestName, guestEmail: b.guestEmail || '', guestPhone: b.guestPhone || '',
      checkIn: toLocalInput(b.checkIn), checkOut: toLocalInput(b.checkOut),
      rate: String(b.rate), cleaningFee: String(b.cleaningFee), platformFee: String(b.platformFee),
      platform: b.platform, status: b.status, propertyId: b.propertyId, notes: b.notes || '',
      platformOther: '', miscCharges: String((b as any).miscCharges || ''),
      miscDescription: (b as any).miscDescription || '',
      reminderAt: toLocalInput((b as any).reminderAt || ''),
      reminderNote: (b as any).reminderNote || '',
      paidAmount: String(b.paidAmount ?? 0),
      guestCnic: (b as any).guestCnic || '', guestFatherName: (b as any).guestFatherName || '',
      guestGender: (b as any).guestGender || '', guestAddress: (b as any).guestAddress || '',
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
      hotelEye: !!((b as any).guestCnic || (b as any).guestFatherName),
      reference: !!((b as any).refName),
    })
    // Load existing documents for this booking
    fetch(`/api/bookings/${b.id}/documents`)
      .then(r => r.json())
      .then(d => setUploadedDocs(d.data || []))
      .catch(() => {})
    setModalOpen(true)
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
      Net: b.netAmount, Platform: b.platform, Status: b.status,
      Property: b.property?.name,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings')
    XLSX.writeFile(wb, 'bookings.xlsx')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description={`${total} total bookings`}>
        <Button variant="outline" size="sm" onClick={exportToExcel}><Download className="h-4 w-4" />Export</Button>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />New Booking</Button>
      </PageHeader>

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
        <Select value={hotelEyeFilter} onValueChange={(v) => { setHotelEyeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Hotel Eye" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Hotel Eye</SelectItem>
            <SelectItem value="NOT_ENTERED">Not Entered</SelectItem>
            <SelectItem value="ENTERED">Entered</SelectItem>
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
          { field: 'platform',    label: 'Platform' },
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
          <Card className="py-16 text-center text-muted-foreground text-sm">No bookings found</Card>
        ) : (
          groupedBookings.map((group) => (
            <div key={group.dateKey} className="space-y-2">
              {/* Date section header */}
              <div className="flex items-center gap-3 px-1">
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
              </div>

              {/* Booking cards */}
              <div className="space-y-2">
                {group.bookings.map((b, idx) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.04 }}
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
                          {b.guestName[0].toUpperCase()}
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

                        {/* Hotel Eye status */}
                        <div className="hidden md:block shrink-0">
                          {(b as any).hotelEyeStatus === 'ENTERED' ? (
                            <Badge variant="outline" className="text-green-600 border-green-600/40 bg-green-500/10 text-[10px] px-1.5 py-0">
                              HE ✓
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-[10px] px-1.5 py-0">
                              HE —
                            </Badge>
                          )}
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
                                title="Click to edit paid amount"
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
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEdit(b)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Duplicate" onClick={() => openCopy(b)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600" title="Push to Hotel Eye" onClick={() => pushToHotelEye(b)}>
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete"
                            onClick={() => { if (confirm('Delete this booking?')) deleteMutation.mutate(b.id) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
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
          <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Scrollable form */}
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 space-y-5 border-r">

            {/* CNIC Scanner */}
            <CnicScanner onExtracted={applyScannedCnic} />

            {/* ── Guest Details ─────────────────────── */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Guest Details</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Guest Name *</Label>
                  <Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Full name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
            <div className="border-t pt-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Stay Details</p>

              {/* Check-in / Check-out */}
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-3 gap-4">
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
                    value={form.platform === 'OTHER' && form.platformOther
                      ? `OTHER:${form.platformOther}`
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
                  {form.platform === 'OTHER' && !form.platformOther && (
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
              <div className="grid grid-cols-3 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
            <div className="border-t">
              <button type="button" onClick={() => toggleSection('misc')} className="w-full flex items-center justify-between py-3 rounded hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Miscellaneous Charges
                  {!sectionOpen.misc && (form.miscCharges || form.miscDescription) && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', sectionOpen.misc && 'rotate-180')} />
              </button>
              {sectionOpen.misc && (
                <div className="grid grid-cols-2 gap-4 pb-4">
                  <div className="space-y-1.5">
                    <Label>Misc Charges ({currencyInfo.symbol})</Label>
                    <Input type="number" min="0" value={form.miscCharges} onChange={(e) => setForm({ ...form, miscCharges: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input value={form.miscDescription} onChange={(e) => setForm({ ...form, miscDescription: e.target.value })} placeholder="e.g. Late checkout fee…" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Reminder (collapsible) ──────────────── */}
            <div className="border-t">
              <button type="button" onClick={() => toggleSection('reminder')} className="w-full flex items-center justify-between py-3 rounded hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <Bell className="h-3.5 w-3.5" /> Reminder
                  {!sectionOpen.reminder && (form.reminderAt || form.reminderNote) && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', sectionOpen.reminder && 'rotate-180')} />
              </button>
              {sectionOpen.reminder && (
                <div className="grid grid-cols-2 gap-4 pb-4">
                  <div className="space-y-1.5">
                    <Label>Remind At</Label>
                    <Input type="datetime-local" value={form.reminderAt} onChange={(e) => setForm({ ...form, reminderAt: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note</Label>
                    <Input value={form.reminderNote} onChange={(e) => setForm({ ...form, reminderNote: e.target.value })} placeholder="e.g. Call guest before check-in" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Hotel Eye / Guest Identity (collapsible) */}
            <div className="border-t">
              <button type="button" onClick={() => toggleSection('hotelEye')} className="w-full flex items-center justify-between py-3 rounded hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <ScanLine className="h-3.5 w-3.5" /> Hotel Eye / Guest Identity
                  {!sectionOpen.hotelEye && (form.guestCnic || form.guestFatherName) && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', sectionOpen.hotelEye && 'rotate-180')} />
              </button>
              {sectionOpen.hotelEye && (
                <div className="space-y-4 pb-4">
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-1.5">
                    <Label>Father Name</Label>
                    <Input value={form.guestFatherName} onChange={(e) => setForm({ ...form, guestFatherName: e.target.value })} placeholder="Father's full name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Permanent Address</Label>
                    <Input value={form.guestAddress} onChange={(e) => setForm({ ...form, guestAddress: e.target.value })} placeholder="As on CNIC" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Temp Province</Label>
                      <Input value={form.tempProvince} onChange={(e) => setForm({ ...form, tempProvince: e.target.value })} placeholder="e.g. KPK" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Temp District</Label>
                      <Input value={form.tempDistrict} onChange={(e) => setForm({ ...form, tempDistrict: e.target.value })} placeholder="e.g. Peshawar" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
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
              )}
            </div>

            {/* ── Local Reference / Dealer (collapsible) */}
            <div className="border-t">
              <button type="button" onClick={() => toggleSection('reference')} className="w-full flex items-center justify-between py-3 rounded hover:bg-muted/30 transition-colors">
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Local Reference / Dealer
                  {!sectionOpen.reference && form.refName && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', sectionOpen.reference && 'rotate-180')} />
              </button>
              {sectionOpen.reference && (
                <div className="space-y-3 pb-4">
                  <div className="grid grid-cols-2 gap-4">
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
              )}
            </div>

            {/* ── Notes ─────────────────────────────── */}
            <div className="border-t pt-4 space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this booking" />
            </div>

            {/* ── Documents ─────────────────────────── */}
            <div className="border-t pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Documents</p>
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
                          <a href={`/api/bookings/${editBooking.id}/documents/${doc.id}`} target="_blank" className="text-xs text-primary hover:underline shrink-0">Download</a>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => deleteDoc(editBooking.id, doc.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Save the booking first, then you can <span className="text-primary">upload documents</span>.
                </p>
              )}
            </div>
          </div>{/* end scrollable form */}

          {/* ── Right summary panel ───────────────────── */}
          <div className="w-[270px] shrink-0 overflow-y-auto bg-muted/20 px-4 py-5 space-y-4 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Booking Summary</p>

            {/* Nights + totals - always visible */}
            {(() => {
              const nights = form.checkIn && form.checkOut
                ? Math.max(1, Math.ceil((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000))
                : 0
              const total = (Number(form.rate)||0)*nights + (Number(form.cleaningFee)||0) + (Number(form.miscCharges)||0)
              const outstanding = Math.max(0, total - (Number(form.paidAmount)||0))
              return (
                <div className="rounded-lg border bg-background p-3 space-y-1.5">
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
            <SumSection title="Guest">
              <SumRow label="Name"    value={form.guestName} />
              <SumRow label="Email"   value={form.guestEmail} />
              <SumRow label="Phone"   value={form.guestPhone} />
            </SumSection>

            {/* Stay */}
            <SumSection title="Stay">
              <SumRow label="Check-in"  value={form.checkIn  ? fnsFormat(new Date(form.checkIn),  'MMM d yyyy, HH:mm') : ''} />
              <SumRow label="Check-out" value={form.checkOut ? fnsFormat(new Date(form.checkOut), 'MMM d yyyy, HH:mm') : ''} />
              <SumRow label="Property"  value={properties.find((p: any) => p.id === form.propertyId)?.name ?? ''} />
              <SumRow label="Platform"  value={form.platformOther || platforms.find(p => p.value === form.platform)?.label || form.platform} />
              <SumRow label="Status"    value={form.status} />
            </SumSection>

            {/* Financials */}
            <SumSection title="Financials">
              <SumRow label="Rate/night"    value={form.rate       ? `${currencyInfo.symbol} ${form.rate}`       : ''} />
              <SumRow label="Cleaning fee"  value={form.cleaningFee? `${currencyInfo.symbol} ${form.cleaningFee}`: ''} />
              <SumRow label="Platform fee"  value={form.platformFee? `${currencyInfo.symbol} ${form.platformFee}`: ''} />
              <SumRow label="Misc charges"  value={form.miscCharges? `${currencyInfo.symbol} ${form.miscCharges}`: ''} />
              {form.miscDescription && <SumRow label="Misc note" value={form.miscDescription} />}
            </SumSection>

            {/* Hotel Eye */}
            {(form.guestCnic || form.guestFatherName || form.guestAddress || form.purposeOfVisit) && (
              <SumSection title="Hotel Eye / Identity">
                <SumRow label="CNIC"          value={form.guestCnic} />
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
              <SumSection title="Reference / Dealer">
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
              <SumSection title="Notes">
                <p className="text-xs text-foreground break-words">{form.notes}</p>
              </SumSection>
            )}
            {form.reminderAt && (
              <SumSection title="Reminder">
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
                const payload = { ...form }
                if (form.platform === 'OTHER' && form.platformOther) {
                  payload.notes = form.notes ? `[${form.platformOther}] ${form.notes}` : form.platformOther
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
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{title}</p>
      <div className="rounded-lg border bg-background px-3 py-2 space-y-1">{children}</div>
    </div>
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
