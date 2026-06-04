'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatCurrency } from '@/lib/utils'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import * as XLSX from 'xlsx'

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

  const monthly = monthlyData?.data?.monthly || []
  const properties = propertyData?.data?.properties || []
  const platforms = platformData?.data?.platforms || []

  const chartMonthly = monthly.map((m: any) => ({
    month: MONTHS[m.month - 1],
    Revenue: m.revenue,
    Expenses: m.expenses,
    'Net Income': m.net,
  }))

  const totalRevenue = monthly.reduce((s: number, m: any) => s + m.revenue, 0)
  const totalExpenses = monthly.reduce((s: number, m: any) => s + m.expenses, 0)
  const totalNet = totalRevenue - totalExpenses

  function exportMonthly() {
    const ws = XLSX.utils.json_to_sheet(monthly.map((m: any) => ({
      Month: MONTHS[m.month - 1], Year: m.year,
      Revenue: m.revenue, Expenses: m.expenses, 'Net Income': m.net,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Report ${year}`)
    XLSX.writeFile(wb, `annual-report-${year}.xlsx`)
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
        <Button variant="outline" size="sm" onClick={exportMonthly}><Download className="h-4 w-4" />Export</Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="monthly">Monthly P&L</TabsTrigger>
          <TabsTrigger value="property">By Property</TabsTrigger>
          <TabsTrigger value="platform">By Platform</TabsTrigger>
        </TabsList>

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
                      {formatCurrency(s.value)}
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
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
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
                      <td className="px-4 py-3 text-right">{formatCurrency(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{formatCurrency(m.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatCurrency(m.net)}
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
              properties.map((p: any, i: number) => (
                <Card key={p.id}>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-2xl font-bold mt-2">{formatCurrency(p.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.totalBookings} bookings · {p.totalNights} nights</p>
                    <p className="text-xs text-muted-foreground">Avg: {formatCurrency(p.avgRate)}/night</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
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
                        <span className="text-sm font-medium">{formatCurrency(p._sum.netAmount || 0)}</span>
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
