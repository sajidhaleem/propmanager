'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Edit, Trash2, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDate, getPlatformColor } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuth } from '@/hooks/useAuth'
import { Income, Property } from '@/types'
import * as XLSX from 'xlsx'
import Link from 'next/link'

const months = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const currentYear = new Date().getFullYear()

const EMPTY_EDIT = { notes: '', receivedAt: '', grossAmount: '', platformFee: '', cleaningFee: '', netAmount: '' }

async function fetchIncome(year: string, month: string, propertyId: string, page: number) {
  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (year       !== 'all') params.append('year',       year)
  if (month      !== 'all') params.append('month',      month)
  if (propertyId !== 'all') params.append('propertyId', propertyId)
  const res = await fetch(`/api/income?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

async function fetchProperties() {
  const res = await fetch('/api/properties?limit=200')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function FinancialsPage() {
  const queryClient = useQueryClient()
  const { format }  = useCurrency()
  const { user }    = useAuth()
  const isAdmin     = user?.role === 'ADMIN'
  const isManager   = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const [year,       setYear]       = useState(String(currentYear))
  const [month,      setMonth]      = useState('all')
  const [propertyId, setPropertyId] = useState('all')
  const [page,       setPage]       = useState(1)
  const [editIncome, setEditIncome] = useState<Income | null>(null)
  const [editForm,   setEditForm]   = useState(EMPTY_EDIT)
  const [editOpen,   setEditOpen]   = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['income', year, month, propertyId, page],
    queryFn:  () => fetchIncome(year, month, propertyId, page),
  })

  const { data: pData } = useQuery({
    queryKey: ['properties'],
    queryFn:  fetchProperties,
  })

  const income: Income[]    = data?.data?.data    || []
  const summary             = data?.data?.summary || {}
  const total               = data?.data?.total   || 0
  const totalPages          = data?.data?.totalPages || 1
  const properties: Property[] = pData?.data || []

  // Reset page when filters change
  function handleFilter(fn: () => void) { fn(); setPage(1) }

  function openEdit(i: Income) {
    setEditIncome(i)
    setEditForm({
      notes:       i.notes        || '',
      receivedAt:  i.receivedAt   ? i.receivedAt.split('T')[0] : '',
      grossAmount: String(i.grossAmount),
      platformFee: String(i.platformFee),
      cleaningFee: String(i.cleaningFee),
      netAmount:   String(i.netAmount),
    })
    setEditOpen(true)
  }

  const editMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/income/${editIncome!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes:       payload.notes || null,
          receivedAt:  payload.receivedAt ? new Date(payload.receivedAt).toISOString() : undefined,
          grossAmount: Number(payload.grossAmount),
          platformFee: Number(payload.platformFee),
          cleaningFee: Number(payload.cleaningFee),
          netAmount:   Number(payload.netAmount),
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setEditOpen(false)
      toast.success('Income record updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/income/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Income record deleted')
    },
    onError: () => toast.error('Delete failed'),
  })

  function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(income.map((i) => ({
      Guest:        i.booking?.guestName,
      Property:     i.booking?.property?.name,
      Platform:     i.booking?.platform,
      'Check-in':   i.booking?.checkIn  ? formatDate(i.booking.checkIn)  : '',
      'Check-out':  i.booking?.checkOut ? formatDate(i.booking.checkOut) : '',
      Received:     formatDate(i.receivedAt),
      Gross:        i.grossAmount,
      'Platform Fee': i.platformFee,
      'Cleaning Fee': i.cleaningFee,
      Net:          i.netAmount,
      Notes:        i.notes || '',
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Income')
    XLSX.writeFile(wb, `income-${year}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Income" description="Revenue auto-recorded when a booking is checked out">
        <Button variant="outline" size="sm" onClick={exportToExcel}><Download className="h-4 w-4" />Export</Button>
      </PageHeader>

      {/* How income works banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Income records are <strong>automatically created</strong> when you mark a booking as{' '}
          <strong>Checked Out</strong> in the{' '}
          <Link href="/dashboard/bookings" className="underline font-semibold hover:text-blue-600">
            Bookings
          </Link>{' '}
          section. Each record reflects the booking's gross amount, fees, and net income.
          Admins and Managers can edit amounts and notes to correct discrepancies.
        </span>
      </div>

      {/* Summary cards — formula: Net = Gross − Platform Fee */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Gross Revenue</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">incl. cleaning fees collected</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
              <p className="text-2xl font-bold mt-2">{format(summary.grossAmount || 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Cleaning Collected</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">included in gross &amp; net</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
              <p className="text-2xl font-bold mt-2 text-yellow-600">{format(summary.cleaningFee || 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Platform Fees</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">deducted from gross</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
              <p className="text-2xl font-bold mt-2 text-red-500">-{format(summary.platformFee || 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Net Income</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">gross − platform fee</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
              <p className="text-2xl font-bold mt-2 text-green-600">{format(summary.netAmount || 0)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={year} onValueChange={(v) => handleFilter(() => setYear(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month} onValueChange={(v) => handleFilter(() => setMonth(v))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={propertyId} onValueChange={(v) => handleFilter(() => setPropertyId(v))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Properties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground">{total} records</p>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Guest</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Received</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gross</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  <span title="Cleaning fee collected from guest — already included in Gross">Cleaning ↑</span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  <span title="Fee paid to the booking platform — deducted from Gross">Platform Fee ↓</span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net</th>
                {isManager && (
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(isManager ? 9 : 8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4" /></td>
                    ))}
                  </tr>
                ))
              ) : income.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 9 : 8} className="px-4 py-12 text-center text-muted-foreground">
                    No income records found.{' '}
                    <Link href="/dashboard/bookings" className="text-primary hover:underline">
                      Mark a booking as Checked Out
                    </Link>{' '}
                    to create one.
                  </td>
                </tr>
              ) : (
                income.map((i) => (
                  <tr key={i.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href="/dashboard/bookings" className="hover:text-primary hover:underline">
                        {i.booking?.guestName}
                      </Link>
                      {i.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{i.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{i.booking?.property?.name}</td>
                    <td className="px-4 py-3">
                      <Badge className={getPlatformColor(i.booking?.platform || 'OTHER')} variant="outline">
                        {i.booking?.platform}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(i.receivedAt)}</td>
                    <td className="px-4 py-3 text-right">{format(i.grossAmount)}</td>
                    <td className="px-4 py-3 text-right text-yellow-600">
                      {i.cleaningFee > 0 ? format(i.cleaningFee) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500">
                      {i.platformFee > 0 ? `-${format(i.platformFee)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{format(i.netAmount)}</td>
                    {isManager && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)}
                            title="Edit income record">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm(`Delete income record for ${i.booking?.guestName}?`)) deleteMutation.mutate(i.id) }}
                              title="Delete income record">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {income.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/50 font-medium">
                  <td colSpan={4} className="px-4 py-3 text-muted-foreground">
                    Total ({total} records)
                  </td>
                  <td className="px-4 py-3 text-right">{format(summary.grossAmount || 0)}</td>
                  <td className="px-4 py-3 text-right text-yellow-600">{format(summary.cleaningFee || 0)}</td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {(summary.platformFee || 0) > 0 ? `-${format(summary.platformFee || 0)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">{format(summary.netAmount || 0)}</td>
                  {isManager && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
          <span>Formula: <strong>Net = Gross − Platform Fee</strong>. Cleaning fee is collected from the guest and included in both Gross and Net (record cleaning costs separately under Expenses).</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1}          onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages}  onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Edit Income Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Income Record</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">
            {editIncome?.booking?.guestName} · {editIncome?.booking?.property?.name}
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Date Received</Label>
              <Input type="date" value={editForm.receivedAt}
                onChange={(e) => setEditForm({ ...editForm, receivedAt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Gross Amount</Label>
              <Input type="number" step="0.01" value={editForm.grossAmount}
                onChange={(e) => setEditForm({ ...editForm, grossAmount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Net Amount</Label>
              <Input type="number" step="0.01" value={editForm.netAmount}
                onChange={(e) => setEditForm({ ...editForm, netAmount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Platform Fee</Label>
              <Input type="number" step="0.01" value={editForm.platformFee}
                onChange={(e) => setEditForm({ ...editForm, platformFee: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cleaning Fee</Label>
              <Input type="number" step="0.01" value={editForm.cleaningFee}
                onChange={(e) => setEditForm({ ...editForm, cleaningFee: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input placeholder="e.g. partial payment, adjusted after dispute"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editMutation.mutate(editForm)} disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
