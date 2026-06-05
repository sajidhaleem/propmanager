'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Filter, Download, Edit, Trash2, Eye } from 'lucide-react'
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
  status: 'CONFIRMED', propertyId: '', notes: '',
}

export default function BookingsPage() {
  const queryClient = useQueryClient()
  const { format } = useCurrency()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const params: Record<string, string> = { page: String(page), limit: '15' }
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
        body: JSON.stringify({ ...payload, rate: Number(payload.rate), cleaningFee: Number(payload.cleaningFee), platformFee: Number(payload.platformFee) }),
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

  function openCreate() { setEditBooking(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(b: Booking) {
    setEditBooking(b)
    setForm({
      guestName: b.guestName, guestEmail: b.guestEmail || '', guestPhone: b.guestPhone || '',
      checkIn: b.checkIn.split('T')[0], checkOut: b.checkOut.split('T')[0],
      rate: String(b.rate), cleaningFee: String(b.cleaningFee), platformFee: String(b.platformFee),
      platform: b.platform, status: b.status, propertyId: b.propertyId, notes: b.notes || '',
    })
    setModalOpen(true)
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Guest</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dates</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nights</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
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
                      <span className="whitespace-nowrap">{formatDate(b.checkIn, 'MMM dd')} – {formatDate(b.checkOut, 'MMM dd, yy')}</span>
                    </td>
                    <td className="px-4 py-3">{b.nights}</td>
                    <td className="px-4 py-3">
                      <Badge className={getPlatformColor(b.platform)} variant="outline">
                        {b.platform === 'BOOKING_COM' ? 'BDC' : b.platform}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(b.status)} variant="outline">
                        {b.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{format(b.netAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
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
            <DialogTitle>{editBooking ? 'Edit Booking' : 'New Booking'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Guest Name *</Label>
              <Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Check-in *</Label>
              <Input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Check-out *</Label>
              <Input type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nightly Rate ($) *</Label>
              <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cleaning Fee ($)</Label>
              <Input type="number" value={form.cleaningFee} onChange={(e) => setForm({ ...form, cleaningFee: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Platform Fee ($)</Label>
              <Input type="number" value={form.platformFee} onChange={(e) => setForm({ ...form, platformFee: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Property *</Label>
              <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v })}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform *</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['AIRBNB','DIRECT','BOOKING_COM','VRBO','OTHER'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW'].map((s) => (
                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editBooking ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
