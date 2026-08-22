'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit, Download, CheckCircle, Banknote } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { SortableTh } from '@/components/ui/sortable-th'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHero, HERO_CONTROL } from '@/components/layout/PageHero'
import { formatDate, getStatusColor } from '@/lib/utils'
import { AmountSummary } from '@/components/ui/amount-summary'
import { useCurrency } from '@/hooks/useCurrency'
import { Payout } from '@/types'
import * as XLSX from 'xlsx'

const PAYOUT_TYPES = ['SALARY','BONUS','COMMISSION','REIMBURSEMENT','CLEANING_FEE','FOOD_ALLOWANCE','OTHER']
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const EMPTY_FORM = { recipientName: '', amount: '', paidAmount: '', date: '', type: 'SALARY', description: '', status: 'PENDING', notes: '' }

async function fetchPayouts(params: Record<string, string>) {
  const res = await fetch(`/api/payouts?${new URLSearchParams(params)}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function PayoutsPage() {
  const queryClient = useQueryClient()
  const { format, currencyInfo } = useCurrency()
  const [year, setYear] = useState(String(currentYear))
  const [month, setMonth] = useState(String(currentMonth))
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editPayout, setEditPayout] = useState<Payout | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [sortBy,    setSortBy]    = useState('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  function handleSort(field: string) {
    if (field === sortBy) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('asc') }
    setPage(1)
  }

  const params: Record<string, string> = { page: String(page), limit: '15', sortBy, sortOrder }
  if (year !== 'all') params.year = year
  if (year !== 'all' && month !== 'all') params.month = month
  if (status !== 'all') params.status = status

  const { data, isLoading } = useQuery({ queryKey: ['payouts', params], queryFn: () => fetchPayouts(params) })
  const payouts: Payout[] = data?.data?.data || []
  const summary    = data?.data?.summary || {}
  const total      = data?.data?.total   || 0
  const totalPages = data?.data?.totalPages || 1

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editPayout ? `/api/payouts/${editPayout.id}` : '/api/payouts'
      const res = await fetch(url, {
        method: editPayout ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, amount: Number(payload.amount), paidAmount: Number(payload.paidAmount) || 0 }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setModalOpen(false)
      toast.success(editPayout ? 'Payout updated' : 'Payout created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const markPaidMutation = useMutation({
    mutationFn: async (p: Payout) => {
      const res = await fetch(`/api/payouts/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Cash-basis reporting reads paidAmount, not status — keep them in sync
        body: JSON.stringify({ status: 'PAID', paidAmount: p.amount }),
      })
      if (!res.ok) throw new Error('Failed to update')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      toast.success('Marked as paid')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payouts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      toast.success('Payout deleted')
    },
  })

  function openCreate() { setEditPayout(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(p: Payout) {
    setEditPayout(p)
    setForm({
      recipientName: p.recipientName, amount: String(p.amount),
      paidAmount: String(p.paidAmount ?? (p.status === 'PAID' ? p.amount : 0)),
      date: p.date.split('T')[0], type: p.type,
      description: p.description || '', status: p.status, notes: p.notes || '',
    })
    setModalOpen(true)
  }

  function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(payouts.map((p) => ({
      Recipient: p.recipientName, Total: p.amount, Paid: p.paidAmount ?? 0,
      Remaining: Math.max(0, p.amount - (p.paidAmount ?? 0)), Date: formatDate(p.date),
      Type: p.type, Status: p.status, Description: p.description,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Payouts')
    XLSX.writeFile(wb, `payouts-${year}.xlsx`)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHero
        title="Payouts"
        description="Track staff payments and disbursements"
        loading={isLoading}
        headline={{
          value: format(summary.paidAmount || 0),
          caption: year === 'all'
            ? 'Paid out · all years'
            : month === 'all'
              ? `Paid out · ${year}`
              : `Paid out · ${MONTH_NAMES[Number(month) - 1]} ${year}`,
        }}
        metrics={[
          { label: 'Pending', value: format(summary.pendingAmount || 0), tone: 'warning' },
          { label: 'Records', value: total },
        ]}
      >
        <Button variant="outline" size="sm" className={HERO_CONTROL} onClick={exportToExcel}><Download className="h-4 w-4" />Export page</Button>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />New Payout</Button>
      </PageHero>

      <div className="flex gap-3">
        <Select value={year} onValueChange={(v) => { setYear(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {[currentYear, currentYear-1, currentYear-2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={(v) => { setMonth(v); setPage(1) }} disabled={year === 'all'}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['PENDING','PAID','CANCELLED'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <SortableTh label="Recipient"   field="recipientName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Type"        field="type"          sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                <SortableTh label="Date"        field="date"          sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Status"      field="status"        sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Total Amount" field="amount"       sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount Paid</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Remaining</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4" /></td>)}
                  </tr>
                ))
              ) : payouts.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={Banknote} title="No payouts recorded" description="Log salaries, bonuses, and reimbursements — paid payouts count toward monthly expenses." action={{ label: 'Add Payout', onClick: openCreate }} /></td></tr>
              ) : (
                payouts.map((p) => {
                  const remaining = Math.max(0, p.amount - (p.paidAmount ?? 0))
                  return (
                  <tr key={p.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.recipientName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{p.type.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.description || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(p.status)} variant="outline">{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{format(p.amount)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{format(p.paidAmount ?? 0)}</td>
                    <td className={`px-4 py-3 text-right ${remaining > 0 ? 'text-amber-500 font-semibold' : 'text-green-600'}`}>
                      {remaining > 0 ? format(remaining) : 'Fully paid ✓'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === 'PENDING' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 text-green-600"
                            onClick={() => markPaidMutation.mutate(p)}
                            title="Mark as paid" aria-label="Mark as paid">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11" onClick={() => openEdit(p)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Delete payout?')) deleteMutation.mutate(p.id) }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editPayout ? 'Edit Payout' : 'New Payout'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Recipient Name *</Label>
              <Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Total Amount ({currencyInfo.symbol}) *</Label>
              <Input type="number" value={form.amount} onChange={(e) => {
                const amount = e.target.value
                setForm(f => ({
                  ...f,
                  amount,
                  // Only auto-track the total into Paid once already marked PAID —
                  // a new PENDING payout hasn't had money move yet.
                  paidAmount: f.status === 'PAID' && f.paidAmount === f.amount ? amount : f.paidAmount,
                }))
              }} />
            </div>
            <div className="space-y-2">
              <Label>Amount Paid ({currencyInfo.symbol})</Label>
              <Input type="number" value={form.paidAmount} onChange={(e) => {
                const paidAmount = e.target.value
                setForm(f => {
                  const remaining = Math.max(0, (Number(f.amount) || 0) - (Number(paidAmount) || 0))
                  return {
                    ...f,
                    paidAmount,
                    // Suggest PAID once fully paid — the user can still change it back
                    status: remaining === 0 && Number(f.amount) > 0 && f.status !== 'CANCELLED' ? 'PAID' : f.status,
                  }
                })
              }} />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYOUT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({
                ...f,
                status: v,
                // Marking as PAID with nothing entered yet assumes fully paid
                paidAmount: v === 'PAID' && !(Number(f.paidAmount) > 0) ? f.amount : f.paidAmount,
              }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['PENDING','PAID','CANCELLED'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {(Number(form.amount) || 0) > 0 && (
              <AmountSummary total={Number(form.amount) || 0} paid={Number(form.paidAmount) || 0} format={format} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editPayout ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
