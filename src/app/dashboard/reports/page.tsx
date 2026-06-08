'use client'

import { useState } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { useQuery } from '@tanstack/react-query'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PLATFORM_COLORS = ['#FF5A5F','#3b82f6','#6366f1','#f59e0b','#6b7280']
const currentYear = new Date().getFullYear()

async function fetchReports(year: string, type: string) {
  const res = await fetch(`/api/reports?year=${year}&type=${type}`)
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function ReportsPage() {
  const [year, setYear] = useState(String(currentYear))
  const { format } = useCurrency()
  const [tab, setTab] = useState('monthly')

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['reports', 'monthly', year],
    queryFn: () => fetchReports(year, 'monthly'),
    enabled: tab === 'monthly',
  })

  const { data: propertyData, isLoading: propertyLoading } = useQuery({
    queryKey: ['reports', 'property', year],
    queryFn: () => fetchReports(year, 'property'),
    enabled: tab === 'property',
  })

  const { data: platformData, isLoading: platformLoading } = useQuery({
    queryKey: ['reports', 'platform', year],
    queryFn: () => fetchReports(year, 'platform'),
    enabled: tab === 'platform',
  })

  const { data: pnlData, isLoading: pnlLoading } = useQuery({
    queryKey: ['reports', 'pnl', year],
    queryFn: () => fetchReports(year, 'pnl'),
    enabled: tab === 'pnl',
  })

  const monthly = monthlyData?.data?.monthly || []
  const properties = propertyData?.data?.properties || []
  const platforms = platformData?.data?.platforms || []
  const pnlRows: any[] = pnlData?.data?.pnl || []
  const pnlTotals: any = pnlData?.data?.totals || {}

  const chartMonthly = monthly.map((m: any) => ({
    month: MONTHS[m.month - 1],
    Revenue: m.revenue,
    Expenses: m.expenses,
    'Net Income': m.net,
  }))

  const totalRevenue = monthly.reduce((s: number, m: any) => s + m.revenue, 0)
  const totalExpenses = monthly.reduce((s: number, m: any) => s + m.expenses, 0)
  const totalNet = totalRevenue - totalExpenses

  async function exportMonthly() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(monthly.map((m: any) => ({
      Month: MONTHS[m.month - 1], Year: m.year,
      Revenue: m.revenue, Expenses: m.expenses, 'Net Income': m.net,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Report ${year}`)
    XLSX.writeFile(wb, `annual-report-${year}.xlsx`)
  }

  async function exportPnL() {
    const XLSX = await import('xlsx')
    const rows = [...pnlRows, { ...pnlTotals, month: 0 }].map(r => ({
      'Month':           r.month === 0 ? 'TOTAL' : MONTHS[r.month - 1],
      'Airbnb Revenue':  r.airbnbRevenue || 0,
      'Other Revenue':   r.otherRevenue || 0,
      'Utilities':       r.UTILITIES    || 0,
      'Cleaning':        r.CLEANING     || 0,
      'Repairs':         r.REPAIRS      || 0,
      'Supplies':        r.SUPPLIES     || 0,
      'Maintenance':     r.MAINTENANCE  || 0,
      'Other Expenses':  r.OTHER        || 0,
      'Total Expenses':  r.totalExpenses || 0,
      'Net Profit':      r.netProfit || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `P&L ${year}`)
    XLSX.writeFile(wb, `pnl-report-${year}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Annual and comparative financial reports">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear-1, currentYear-2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={tab === 'pnl' ? exportPnL : exportMonthly}>
          <Download className="h-4 w-4" />Export
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pnl">P&amp;L Report</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Overview</TabsTrigger>
          <TabsTrigger value="property">By Property</TabsTrigger>
          <TabsTrigger value="platform">By Platform</TabsTrigger>
        </TabsList>

        {/* ── P&L Report Tab ── */}
        <TabsContent value="pnl" className="space-y-4">
          {pnlLoading ? (
            <div className="space-y-2">{[...Array(13)].map((_,i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    {['Month','Airbnb Revenue','Other Revenue','Utilities','Cleaning','Repairs','Supplies','Maintenance','Other Exp.','Total Expenses','Net Profit'].map(h => (
                      <th key={h} className="px-3 py-3 text-right first:text-left font-semibold text-xs text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pnlRows.map((row: any) => {
                    const isProfit = row.netProfit >= 0
                    return (
                      <tr key={row.month} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 font-medium">{MONTHS[row.month - 1]}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-green-600 dark:text-green-400">{format(row.airbnbRevenue || 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{format(row.otherRevenue || 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.UTILITIES || 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.CLEANING || 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.REPAIRS || 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.SUPPLIES || 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.MAINTENANCE || 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.OTHER || 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-red-600">{format(row.totalExpenses || 0)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {format(row.netProfit || 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {pnlTotals && (
                  <tfoot>
                    <tr className="bg-muted border-t-2 border-border font-bold">
                      <td className="px-3 py-3 text-xs uppercase tracking-wide">Total {year}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-green-600">{format(pnlTotals.airbnbRevenue || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-blue-600">{format(pnlTotals.otherRevenue || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.UTILITIES || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.CLEANING || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.REPAIRS || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.SUPPLIES || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.MAINTENANCE || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.OTHER || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-600">{format(pnlTotals.totalExpenses || 0)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${(pnlTotals.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {format(pnlTotals.netProfit || 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {/* Annual summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: `${year} Total Revenue`, value: totalRevenue, positive: true },
              { label: `${year} Total Expenses`, value: totalExpenses, positive: false },
              { label: `${year} Net Income`, value: totalNet, positive: totalNet >= 0 },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  {monthlyLoading ? <Skeleton className="h-8 w-32 mt-2" /> : (
                    <p className={`text-2xl font-bold mt-2 ${s.positive ? 'text-green-600' : 'text-red-500'}`}>
                      {format(s.value)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly P&L — {year}</CardTitle>
              <CardDescription>Revenue, expenses, and net income by month</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? <Skeleton className="h-72" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartMonthly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => format(v)} />
                    <Tooltip formatter={(v: number) => format(v)} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#3b82f6" radius={[3,3,0,0]} />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
                    <Bar dataKey="Net Income" fill="#10b981" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Monthly detail table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Month</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Expenses</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net Income</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m: any) => (
                    <tr key={m.month} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{MONTHS[m.month - 1]} {m.year}</td>
                      <td className="px-4 py-3 text-right">{format(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{format(m.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {format(m.net)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {m.revenue > 0 ? `${Math.round((m.net / m.revenue) * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="property" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {propertyLoading ? (
              [...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>)
            ) : (
              properties.map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-2xl font-bold mt-2 text-green-600">{format(p.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.totalBookings} bookings · {p.totalNights} nights</p>
                    <p className="text-xs text-muted-foreground">Avg: {format(p.avgRate)}/night</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Property revenue bar chart */}
          {!propertyLoading && properties.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Property — {year}</CardTitle>
                <CardDescription>Compare total net revenue across all properties</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={properties.map((p: any) => ({
                    name:     p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
                    Revenue:  p.totalRevenue,
                    Bookings: p.totalBookings,
                    Nights:   p.totalNights,
                  }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => format(v)} />
                    <Tooltip formatter={(v: number, name: string) =>
                      name === 'Revenue' ? [format(v), 'Revenue'] : [v, name]
                    } />
                    <Legend />
                    <Bar dataKey="Revenue"  fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="Bookings" fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="Nights"   fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="platform" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Bookings by Platform</CardTitle></CardHeader>
              <CardContent>
                {platformLoading ? <Skeleton className="h-72" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={platforms.map((p: any) => ({ name: p.platform, value: p._count.id }))}
                        cx="50%" cy="50%" outerRadius={100} dataKey="value">
                        {platforms.map((_: any, i: number) => <Cell key={i} fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Revenue by Platform</CardTitle></CardHeader>
              <CardContent>
                {platformLoading ? <Skeleton className="h-72" /> : (
                  <div className="space-y-3 pt-2">
                    {platforms.map((p: any, i: number) => (
                      <div key={p.platform} className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[i % PLATFORM_COLORS.length] }} />
                        <span className="flex-1 text-sm">{p.platform}</span>
                        <span className="text-sm font-medium">{format(p._sum.netAmount || 0)}</span>
                        <span className="text-xs text-muted-foreground">{p._count.id} bookings</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
