'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDate, getPlatformColor } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Income } from '@/types'
import * as XLSX from 'xlsx'

async function fetchIncome(year: string, month: string) {
  const params = new URLSearchParams({ limit: '50' })
  if (year !== 'all') params.append('year', year)
  if (month !== 'all') params.append('month', month)
  const res = await fetch(`/api/income?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

const months = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
const currentYear = new Date().getFullYear()

export default function FinancialsPage() {
  const [year, setYear] = useState(String(currentYear))
  const { format } = useCurrency()
  const [month, setMonth] = useState('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['income', year, month],
    queryFn: () => fetchIncome(year, month),
  })

  const income: Income[] = data?.data?.data || []
  const summary = data?.data?.summary || {}
  const total = data?.data?.total || 0
  const totalPages = data?.data?.totalPages || 1

  function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(income.map((i) => ({
      'Booking': i.booking?.guestName, 'Property': i.booking?.property?.name,
      'Check-in': i.booking?.checkIn ? formatDate(i.booking.checkIn) : '',
      'Received': formatDate(i.receivedAt), 'Gross': i.grossAmount,
      'Platform Fee': i.platformFee, 'Net': i.netAmount, 'Month': i.month, 'Year': i.year,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Income')
    XLSX.writeFile(wb, `income-${year}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Income" description="Track all revenue from bookings">
        <Button variant="outline" size="sm" onClick={exportToExcel}><Download className="h-4 w-4" />Export</Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Gross Revenue', value: summary.grossAmount, color: 'blue' },
          { label: 'Platform Fees', value: summary.platformFee, color: 'red' },
          { label: 'Cleaning Fees', value: summary.cleaningFee, color: 'yellow' },
          { label: 'Net Income', value: summary.netAmount, color: 'green' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              {isLoading ? <Skeleton className="h-8 w-24 mt-2" /> : (
                <p className="text-2xl font-bold mt-2">{format(s.value || 0)}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground flex items-center">{total} records</p>
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
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Fees</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4" /></td>
                    ))}
                  </tr>
                ))
              ) : income.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No income records found</td></tr>
              ) : (
                income.map((i) => (
                  <tr key={i.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{i.booking?.guestName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.booking?.property?.name}</td>
                    <td className="px-4 py-3">
                      <Badge className={getPlatformColor(i.booking?.platform || 'OTHER')} variant="outline">
                        {i.booking?.platform}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(i.receivedAt)}</td>
                    <td className="px-4 py-3 text-right">{format(i.grossAmount)}</td>
                    <td className="px-4 py-3 text-right text-red-500">-{format(i.platformFee + i.cleaningFee)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{format(i.netAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {income.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/50 font-medium">
                  <td colSpan={4} className="px-4 py-3 text-muted-foreground">Total ({total} records)</td>
                  <td className="px-4 py-3 text-right">{format(summary.grossAmount || 0)}</td>
                  <td className="px-4 py-3 text-right text-red-500">-{format((summary.platformFee || 0) + (summary.cleaningFee || 0))}</td>
                  <td className="px-4 py-3 text-right text-green-600">{format(summary.netAmount || 0)}</td>
                </tr>
              </tfoot>
            )}
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
    </div>
  )
}
