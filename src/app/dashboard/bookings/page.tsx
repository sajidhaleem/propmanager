'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Edit, Trash2, Upload, FileText, X, Loader2, Copy, Check, Bell } from 'lucide-react'
import { SortableTh } from '@/components/ui/sortable-th'
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
import { formatDate, getStatusColor, getPlatformColor } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking } from '@/types'
import * as XLSX from 'xlsx'

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
}

interface UploadedDoc { id: string; name: string; mimeType: string; size: number }

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
  const [modalOpen, setModalOpen] = useState(false)
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null)
  const [editingAmountValue, setEditingAmountValue] = useState('')
  const [sortBy,    setSortBy]    = useState('checkIn')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  function handleSort(field: string) {
    if (field === sortBy) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('asc') }
    setPage(1)
  }

  const params: Record<string, string> = { page: String(page), limit: '15', sortBy, sortOrder }
  if (search) params.search = search
  if (statusFilter !== 'all') params.status = statusFilter
  if (platformFilter !== 'all') params.platform = platformFilter

  const { data, isLoading } = useQuery({ queryKey: ['bookings', params], queryFn: () => fetchBookings(params) })
  const { data: propertiesData } = useQuery({ queryKey: ['properties'], queryFn: fetchProperties })

  const bookings: Booking[] = data?.data?.data || []
  const total = data?.data?.total || 0
  const totalPages = data?.data?.totalPages || 1
  const properties = propertiesData?.data || []

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
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setEditingAmountId(null)
      toast.success('Amount updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function saveAmount(id: string) {
    const val = parseFloat(editingAmountValue)
    if (isNaN(val) || val < 0) { toast.error('Enter a valid amount'); return }
    amountMutation.mutate({ id, rate: val })
  }

  function openCreate() {
    setEditBooking(null)
    setForm(EMPTY_FORM)
    setUploadedDocs([])
    setModalOpen(true)
  }
  function openCopy(b: Booking) {
    setEditBooking(null)
    setForm({
      guestName: b.guestName,
      guestEmail: b.guestEmail || '',
      guestPhone: b.guestPhone || '',
      checkIn: '',
      checkOut: '',
      rate: String(b.rate),
      cleaningFee: String(b.cleaningFee),
      platformFee: String(b.platformFee),
      platform: b.platform,
      status: 'CONFIRMED',
      propertyId: b.propertyId,
      notes: b.notes || '',
      platformOther: '',
      miscCharges: String((b as any).miscCharges || ''),
      miscDescription: (b as any).miscDescription || '',
      reminderAt: '', reminderNote: '',
    })
    setUploadedDocs([])
    setModalOpen(true)
  }
  function openEdit(b: Booking) {
    setEditBooking(b)
    setForm({
      guestName: b.guestName, guestEmail: b.guestEmail || '', guestPhone: b.guestPhone || '',
      checkIn: toLocalInput(b.checkIn),
      checkOut: toLocalInput(b.checkOut),
      rate: String(b.rate), cleaningFee: String(b.cleaningFee), platformFee: String(b.platformFee),
      platform: b.platform, status: b.status, propertyId: b.propertyId, notes: b.notes || '',
      platformOther: '',
      miscCharges: String((b as any).miscCharges || ''),
      miscDescription: (b as any).miscDescription || '',
      reminderAt: toLocalInput((b as any).reminderAt || ''),
      reminderNote: (b as any).reminderNote || '',
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

  function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(bookings.map((b) => ({
      Guest: b.guestName, Email: b.guestEmail, 'Check-in': formatDate(b.checkIn),
      'Check-out': formatDate(b.checkOut), Nights: b.nights, Rate: b.rate,
      Total: b.totalAmount, Net: b.netAmount, Platform: b.platform, Status: b.status,
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
            {['AIRBNB','DIRECT','BOOKING_COM','VRBO','OTHER'].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <SortableTh label="Guest"    field="guestName"   sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property</th>
                <SortableTh label="Check-in" field="checkIn"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Nights"   field="nights"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Platform" field="platform"    sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Status"   field="status"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Amount"   field="totalAmount" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No bookings found</td></tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.guestName}</p>
                      {b.guestEmail && <p className="text-xs text-muted-foreground">{b.guestEmail}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{b.property?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="whitespace-nowrap text-xs leading-relaxed">
                        <div><span className="font-medium text-foreground">{formatDate(b.checkIn, 'MMM d')}</span> <span className="text-muted-foreground">{formatDate(b.checkIn, 'h:mm a')}</span></div>
                        <div><span className="font-medium text-foreground">{formatDate(b.checkOut, 'MMM d')}</span> <span className="text-muted-foreground">{formatDate(b.checkOut, 'h:mm a')}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{b.nights}</td>
                    <td className="px-4 py-3">
                      <Badge className={getPlatformColor(b.platform)} variant="outline">
                        {b.platform === 'BOOKING_COM' ? 'Booking.com' : b.platform === 'VRBO' ? 'VRBO' : b.platform.charAt(0) + b.platform.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={b.status}
                        onValueChange={(newStatus) => statusMutation.mutate({ id: b.id, status: newStatus })}
                      >
                        <SelectTrigger className={`h-7 w-[130px] text-xs border px-2 ${getStatusColor(b.status)}`}>
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
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingAmountId === b.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            min="0"
                            value={editingAmountValue}
                            onChange={(e) => setEditingAmountValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveAmount(b.id)
                              if (e.key === 'Escape') setEditingAmountId(null)
                            }}
                            className="h-7 w-24 text-xs text-right"
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700"
                            onClick={() => saveAmount(b.id)} disabled={amountMutation.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                            onClick={() => setEditingAmountId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="font-semibold tabular-nums hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer w-full text-right"
                          title="Click to edit amount"
                          onClick={() => { setEditingAmountId(b.id); setEditingAmountValue(String(b.rate)) }}
                        >
                          {format(b.rate)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit booking" onClick={() => openEdit(b)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Duplicate booking" onClick={() => openCopy(b)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete booking"
                          onClick={() => { if (confirm('Delete this booking?')) deleteMutation.mutate(b.id) }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editBooking ? 'Edit Booking' : form.guestName ? `Copy Booking — ${form.guestName}` : 'New Booking'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* 1. Guest Name */}
            <div className="space-y-1.5">
              <Label>Guest Name *</Label>
              <Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Full name" />
            </div>

            {/* 2–3. Email & Phone side by side */}
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

            {/* 4–5. Check-in & Check-out side by side */}
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

            {/* 6. Payment Received */}
            <div className="space-y-1.5">
              <Label>Payment Received ({currencyInfo.symbol}) *</Label>
              <Input type="number" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="0" />
            </div>

            {/* 7–8. Cleaning Fee & Platform Fee side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cleaning Fee ({currencyInfo.symbol})</Label>
                <Input type="number" min="0" value={form.cleaningFee} onChange={(e) => setForm({ ...form, cleaningFee: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Platform Fee ({currencyInfo.symbol})</Label>
                <Input type="number" min="0" value={form.platformFee} onChange={(e) => setForm({ ...form, platformFee: e.target.value })} />
              </div>
            </div>

            {/* 9. Property */}
            <div className="space-y-1.5">
              <Label>Property *</Label>
              <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 10. Platform */}
            <div className="space-y-1.5">
              <Label>Platform *</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v, platformOther: v !== 'OTHER' ? '' : form.platformOther })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'AIRBNB',      label: 'Airbnb' },
                    { value: 'DIRECT',      label: 'Direct' },
                    { value: 'BOOKING_COM', label: 'Booking.com' },
                    { value: 'VRBO',        label: 'VRBO' },
                    { value: 'OTHER',       label: 'Other (specify below)' },
                  ].map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.platform === 'OTHER' && (
                <Input
                  value={form.platformOther}
                  onChange={(e) => setForm({ ...form, platformOther: e.target.value })}
                  placeholder="e.g. Facebook, Walk-in, Referral…"
                  className="mt-2"
                  autoFocus
                />
              )}
            </div>

            {/* 11. Status */}
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

            {/* 12–13. Misc Charges & Description side by side */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Miscellaneous Charges</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Misc Charges ({currencyInfo.symbol})</Label>
                  <Input type="number" min="0" value={form.miscCharges} onChange={(e) => setForm({ ...form, miscCharges: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Misc Description</Label>
                  <Input value={form.miscDescription} onChange={(e) => setForm({ ...form, miscDescription: e.target.value })} placeholder="e.g. Late checkout fee…" />
                </div>
              </div>
            </div>

            {/* 14. Reminder */}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Bell className="h-3.5 w-3.5" /> Reminder
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Remind At</Label>
                  <Input type="datetime-local" value={form.reminderAt} onChange={(e) => setForm({ ...form, reminderAt: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Reminder Note</Label>
                  <Input value={form.reminderNote} onChange={(e) => setForm({ ...form, reminderNote: e.target.value })} placeholder="e.g. Call guest before check-in" />
                </div>
              </div>
            </div>

            {/* 15. Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this booking" />
            </div>

            {/* 15. Documents */}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Documents</p>
              {editBooking ? (
                <div className="space-y-3">
                  {/* Upload button */}
                  <label className={`flex items-center gap-2 cursor-pointer w-fit rounded-lg border border-dashed px-4 py-2.5 text-sm transition-colors ${uploading ? 'opacity-50 pointer-events-none' : 'hover:bg-accent'}`}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-muted-foreground">{uploading ? 'Uploading…' : 'Upload file'}</span>
                    <span className="text-xs text-muted-foreground/60">PDF, DOC, XLS, Image (max 5MB)</span>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt" onChange={(e) => handleFileUpload(e, editBooking.id)} disabled={uploading} />
                  </label>
                  {/* Uploaded files list */}
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
                  Save the booking first, then you can upload documents.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const payload = { ...form }
                // Merge platformOther into notes only once, cleanly
                if (form.platform === 'OTHER' && form.platformOther) {
                  payload.notes = form.notes
                    ? `[${form.platformOther}] ${form.notes}`
                    : form.platformOther
                }
                saveMutation.mutate(payload)
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : editBooking ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
