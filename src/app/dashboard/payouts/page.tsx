'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit, Download, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDate, getStatusColor } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Payout } from '@/types'
import * as XLSX from 'xlsx'

const PAYOUT_TYPES = ['SALARY','BONUS','COMMISSION','REIMBURSEMENT','CLEANING_FEE','OTHER']
const currentYear = new Date().getFullYear()
const EMPTY_FORM = { recipientName: '', amount: '', date: '', type: 'SALARY', description: '', status: 'PENDING', notes: '' }

async function fetchPayouts(params: Record<string, string>) {
  const res = await fetch(`/api/payouts?${new URLSearchParams(params)}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function PayoutsPage() {
  const queryClient = useQueryClient()
  const { format, currencyInfo } = useCurrency()
  const [year, setYear] = useState(String(currentYear))
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editPayout, setEditPayout] = useState<Payout | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const params: Record<string, string> = { page: String(page), limit: '15' }
  if (year !== 'all') params.year = year
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
        body: JSON.stringify({ ...payload, amount: Number(payload.amount) }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
      toast.success(editPayout ? 'Payout updated' : 'Payout created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      })
      if (!res.ok) throw new Error('Failed to update')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] })
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
      toast.success('Payout deleted')
    },
  })

  function openCreate() { setEditPayout(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(p: Payout) {
    setEditPayout(p)
    setForm({
      recipientName: p.recipientName, amount: String(p.amount),
      date: p.date.split('T')[0], type: p.type,
      description: p.description || '', status: p.status, notes: p.notes || '',
    })
    setModalOpen(true)
  }

  function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(payouts.map((p) => ({
      Recipient: p.recipientName, Amount: p.amount, Date: formatDate(p.date),
      Type: p.type, Status: p.status, Description: p.description,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Payouts')
    XLSX.writeFile(wb, `payouts-${year}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" description="Track staff payments and disbursements">
        <Button variant="outline" size="sm" onClick={exportToExcel}><Download className="h-4 w-4" />Export</Button>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />New Payout</Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Total Paid</p>
          {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
            <p className="text-2xl font-bold mt-2 text-green-600">{format(summary.paidAmount || 0)}</p>
          )}
        </CardContent></Card>
        <Card className="border-yellow-200 dark:border-yellow-800"><CardContent className="p-6">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending</p>
          {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
            <p className="text-2xl font-bold mt-2 text-yellow-600">{format(summary.pendingAmount || 0)}</p>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Total Records</p>
          <p className="text-2xl font-bold mt-2">{total}</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-3">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {[currentYear, currentYear-1, currentYear-2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recipient</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4" /></td>)}
                  </tr>
                ))
              ) : payouts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No payouts found</td></tr>
              ) : (
                payouts.map((p) => (
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === 'PENDING' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600"
                            onClick={() => markPaidMutation.mutate(p.id)}
                            title="Mark as paid">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Delete payout?')) deleteMutation.mutate(p.id) }}>
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
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Recipient Name *</Label>
              <Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Amount ({currencyInfo.symbol}) *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
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
