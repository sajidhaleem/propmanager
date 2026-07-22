'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit, Download, Receipt } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { SortableTh } from '@/components/ui/sortable-th'
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
import { formatDate } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Expense } from '@/types'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import * as XLSX from 'xlsx'

const CATEGORIES = ['CLEANING','MAINTENANCE','UTILITIES','SUPPLIES','MARKETING','PLATFORM_FEES','INSURANCE','TAXES','SALARY','REPAIRS','OTHER']
const CATEGORY_COLORS: Record<string, string> = {
  CLEANING: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', MAINTENANCE: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  UTILITIES: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300', SUPPLIES: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  SALARY: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300', TAXES: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  INSURANCE: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300', REPAIRS: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  MARKETING: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300', PLATFORM_FEES: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300',
}
const currentYear = new Date().getFullYear()
const EMPTY_FORM = { date: '', category: 'CLEANING', description: '', amount: '', vendor: '', notes: '' }

async function fetchExpenses(params: Record<string, string>) {
  const res = await fetch(`/api/expenses?${new URLSearchParams(params)}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function ExpensesPage() {
  const queryClient = useQueryClient()
  const { format, currencyInfo } = useCurrency()
  const [year, setYear] = useState(String(currentYear))
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
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
  if (category !== 'all') params.category = category
  if (search) params.search = search

  const { data, isLoading } = useQuery({ queryKey: ['expenses', params], queryFn: () => fetchExpenses(params) })

  const expenses: Expense[] = data?.data?.data || []
  const summary = data?.data?.summary || {}
  const total = data?.data?.total || 0
  const totalPages = data?.data?.totalPages || 1
  const byCategory = summary.byCategory || []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editExpense ? `/api/expenses/${editExpense.id}` : '/api/expenses'
      const res = await fetch(url, {
        method: editExpense ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, amount: Number(payload.amount) }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setModalOpen(false)
      toast.success(editExpense ? 'Expense updated' : 'Expense added')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      toast.success('Expense deleted')
    },
  })

  function openCreate() { setEditExpense(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(e: Expense) {
    setEditExpense(e)
    setForm({
      date: e.date.split('T')[0], category: e.category, description: e.description,
      amount: String(e.amount), vendor: e.vendor || '', notes: e.notes || '',
    })
    setModalOpen(true)
  }

  function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(expenses.map((e) => ({
      Date: formatDate(e.date), Category: e.category, Description: e.description,
      Amount: e.amount, Vendor: e.vendor,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
    XLSX.writeFile(wb, `expenses-${year}.xlsx`)
  }

  const chartData = byCategory.map((c: any) => ({
    category: c.category.replace('_', ' '),
    amount: c._sum.amount || 0,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Expenses" description="Track operational costs and expenses">
        <Button variant="outline" size="sm" onClick={exportToExcel}><Download className="h-4 w-4" />Export page</Button>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Expense</Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-full sm:col-span-1">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
              <p className="text-2xl font-bold mt-2 text-red-500">{format(summary.totalAmount || 0)}</p>
            )}
          </CardContent>
        </Card>
        {byCategory.slice(0, 3).map((c: any) => (
          <Card key={c.category}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{c.category.replace('_', ' ')}</p>
              {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
                <p className="text-2xl font-bold mt-2">{format(c._sum.amount || 0)}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                    if (v >= 1_000) return `${Math.round(v / 1_000)}K`
                    return String(v)
                  }}
                  width={40}
                />
                <Tooltip formatter={(v: number) => [format(v), 'Amount']} />
                <Bar dataKey="amount" fill="#e5484d" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {[currentYear, currentYear-1, currentYear-2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <SortableTh label="Date"        field="date"        sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Category"    field="category"    sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Description" field="description" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Vendor"      field="vendor"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Amount"      field="amount"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4" /></td>)}
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={Receipt} title="No expenses recorded" description="Track utilities, cleaning, and repairs to see accurate monthly profit." action={{ label: 'Add Expense', onClick: openCreate }} /></td></tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <Badge className={CATEGORY_COLORS[e.category] || CATEGORY_COLORS.OTHER} variant="outline">
                        {e.category.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{e.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.vendor || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">{format(e.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11" onClick={() => openEdit(e)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Delete expense?')) deleteMutation.mutate(e.id) }}>
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
          <DialogHeader><DialogTitle>{editExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Amount ({currencyInfo.symbol}) *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editExpense ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
