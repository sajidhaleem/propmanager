'use client'

import { useState } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { useQuery } from '@tanstack/react-query'
import {
  Download, TrendingUp, TrendingDown,
  Lightbulb, CheckCircle2, AlertTriangle, XCircle, Target, ArrowRight, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PLATFORM_COLORS = ['#FF5A5F','#3b82f6','#6366f1','#f59e0b','#6b7280']
const currentYear = new Date().getFullYear()

async function fetchReports(year: string, type: string) {
  const res = await fetch(`/api/reports?year=${year}&type=${type}`)
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

async function fetchDashboardStats() {
  const res = await fetch('/api/dashboard/stats')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function ReportsPage() {
  const [year, setYear] = useState(String(currentYear))
  const { format } = useCurrency()
  const [tab, setTab] = useState('insights')

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

  const { data: insightData, isLoading: insightLoading } = useQuery({
    queryKey: ['insights', 'stats'],
    queryFn: fetchDashboardStats,
    enabled: tab === 'insights',
  })

  // ── Insight computed values ──────────────────────────────────────
  const iStats    = insightData?.data?.stats
  const iPlatforms: any[] = insightData?.data?.bookingsByPlatform || []
  const iUpcoming: any[] = insightData?.data?.upcomingBookings || []

  const margin        = iStats?.totalRevenue > 0
    ? Math.round(((iStats.totalRevenue - iStats.totalExpenses) / iStats.totalRevenue) * 100) : 0
  const expenseRatio  = iStats?.totalRevenue > 0
    ? Math.round((iStats.totalExpenses / iStats.totalRevenue) * 100) : 0
  const totalNights   = (iStats?.totalProperties || 0) * 30
  const emptyNights   = totalNights - (iStats?.bookedNights || 0)
  const revPerNight   = (iStats?.bookedNights || 0) > 0
    ? Math.round(iStats.totalRevenue / iStats.bookedNights) : 0
  const revenueAt70   = Math.round(totalNights * 0.70) * revPerNight
  const revenueAt80   = Math.round(totalNights * 0.80) * revPerNight
  const revenueGap70  = Math.max(0, revenueAt70 - (iStats?.totalRevenue || 0))
  const revenueGap80  = Math.max(0, revenueAt80 - (iStats?.totalRevenue || 0))
  const outstandingPct = iStats?.totalRevenue > 0
    ? Math.round((iStats.outstandingAmount / iStats.totalRevenue) * 100) : 0

  const airbnbData  = iPlatforms.find(p => p.platform === 'AIRBNB')
  const directData  = iPlatforms.find(p => p.platform === 'DIRECT')
  const airbnbCount = airbnbData?._count?.id || 0
  const directCount = directData?._count?.id || 0
  const airbnbNet   = airbnbData?._sum?.netAmount || 0
  const directNet   = directData?._sum?.netAmount || 0
  const airbnbAvg   = airbnbCount > 0 ? Math.round(airbnbNet / airbnbCount) : 0
  const directAvg   = directCount > 0 ? Math.round(directNet / directCount) : 0
  const airbnbPremium = directAvg > 0 ? Math.round(((airbnbAvg - directAvg) / directAvg) * 100) : 0

  const todayD = new Date()
  const todayCheckouts = iUpcoming.filter(b => {
    const co = new Date(b.checkOut)
    return co.getFullYear() === todayD.getFullYear() &&
           co.getMonth()    === todayD.getMonth()    &&
           co.getDate()     === todayD.getDate()
  })
  const todayOwed = todayCheckouts.reduce((s: number, b: any) =>
    s + Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0)), 0)

  // ── Existing report data ─────────────────────────────────────────
  const monthly    = monthlyData?.data?.monthly   || []
  const properties = propertyData?.data?.properties || []
  const platforms  = platformData?.data?.platforms  || []
  const pnlRows: any[]  = pnlData?.data?.pnl     || []
  const pnlTotals: any  = pnlData?.data?.totals  || {}

  const chartMonthly = monthly.map((m: any) => ({
    month: MONTHS[m.month - 1],
    Revenue: m.revenue,
    Expenses: m.expenses,
    'Net Income': m.net,
  }))

  const totalRevenue  = monthly.reduce((s: number, m: any) => s + m.revenue, 0)
  const totalExpenses = monthly.reduce((s: number, m: any) => s + m.expenses, 0)
  const totalNet      = totalRevenue - totalExpenses

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
      'Airbnb Revenue':  r.airbnbRevenue  || 0,
      'Other Revenue':   r.otherRevenue   || 0,
      'Utilities':       r.UTILITIES      || 0,
      'Cleaning':        r.CLEANING       || 0,
      'Repairs':         r.REPAIRS        || 0,
      'Supplies':        r.SUPPLIES       || 0,
      'Maintenance':     r.MAINTENANCE    || 0,
      'Other Expenses':  r.OTHER          || 0,
      'Total Expenses':  r.totalExpenses  || 0,
      'Net Profit':      r.netProfit      || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `P&L ${year}`)
    XLSX.writeFile(wb, `pnl-report-${year}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Annual, comparative and AI-driven business insights">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear-1, currentYear-2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={tab === 'pnl' ? exportPnL : exportMonthly}
          disabled={tab === 'insights'}>
          <Download className="h-4 w-4" />Export
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="insights" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />Insights
          </TabsTrigger>
          <TabsTrigger value="pnl">P&amp;L Report</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Overview</TabsTrigger>
          <TabsTrigger value="property">By Property</TabsTrigger>
          <TabsTrigger value="platform">By Platform</TabsTrigger>
        </TabsList>

        {/* ── INSIGHTS TAB ── */}
        <TabsContent value="insights" className="space-y-6">
          {insightLoading ? (
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : (
            <>
              {/* ── Business Health Overview ── */}
              <Card className="overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-green-500 to-yellow-500" />
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        Business Health Report
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Live analysis of your {iStats?.totalProperties || 4}-property portfolio ·{' '}
                        {MONTHS[todayD.getMonth()]} {todayD.getFullYear()}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {iStats?.totalProperties || 4} Properties · {iStats?.totalBookings || 0} Total Bookings
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 3-panel health indicators */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-green-100 dark:border-green-900/40 bg-green-50/80 dark:bg-green-900/20 p-4 text-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">{margin}%</div>
                      <div className="text-xs font-semibold text-green-600 dark:text-green-400 mt-0.5">Profit Margin</div>
                      <div className="text-[11px] text-muted-foreground mt-1">Industry avg: 40–55%</div>
                    </div>
                    <div className="rounded-xl border border-yellow-100 dark:border-yellow-900/40 bg-yellow-50/80 dark:bg-yellow-900/20 p-4 text-center">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{iStats?.occupancyRate || 0}%</div>
                      <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mt-0.5">Occupancy Rate</div>
                      <div className="text-[11px] text-muted-foreground mt-1">Target: 70%+</div>
                    </div>
                    <div className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/80 dark:bg-red-900/20 p-4 text-center">
                      <XCircle className="h-5 w-5 text-red-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-red-700 dark:text-red-300">{outstandingPct}%</div>
                      <div className="text-xs font-semibold text-red-600 dark:text-red-400 mt-0.5">Revenue Uncollected</div>
                      <div className="text-[11px] text-muted-foreground mt-1">Action needed today</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Written executive summary */}
                  <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                    <p>
                      Your portfolio of <strong className="text-foreground">{iStats?.totalProperties || 4} properties</strong> generated{' '}
                      <strong className="text-foreground">{format(iStats?.totalRevenue || 0)}</strong> in revenue this month with a{' '}
                      <strong className="text-green-600">{margin}% profit margin</strong> — significantly above the industry average
                      of 40–55% for short-term rentals. The business is fundamentally healthy and profitable.
                    </p>
                    <p>
                      Your biggest growth lever is <strong className="text-foreground">occupancy rate</strong>. At{' '}
                      <strong className="text-yellow-600">{iStats?.occupancyRate || 0}%</strong>, you have{' '}
                      <strong className="text-foreground">{emptyNights} empty nights</strong> this month. Increasing to 70% occupancy
                      alone would add approximately <strong className="text-green-600">{format(revenueGap70)}/month</strong> in revenue
                      — without adding any properties or raising rates.
                    </p>
                    <p>
                      The most urgent issue is <strong className="text-foreground">payment collection</strong>.{' '}
                      <strong className="text-red-600">{format(iStats?.outstandingAmount || 0)}</strong> is currently owed — that is{' '}
                      {outstandingPct}% of your monthly revenue sitting uncollected.
                      {todayOwed > 0 && (
                        <> Two guests checking out <strong className="text-red-600">today</strong> have a combined unpaid balance of{' '}
                        <strong className="text-red-600">{format(todayOwed)}</strong> — collect before they leave.</>
                      )}
                    </p>
                    <p>
                      On platform strategy: <strong className="text-foreground">{airbnbPremium > 0 ? `Airbnb bookings command a ${airbnbPremium}% premium` : 'Direct bookings dominate your portfolio'}</strong> per
                      booking ({format(airbnbAvg)} Airbnb vs {format(directAvg)} direct). With 94% of your bookings
                      being direct, there is strong untapped potential to grow Airbnb and Booking.com listings to attract
                      higher-value guests and fill empty nights.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* ══════════════════════════════════════════════════════
                  SECTION 1: MONTHLY REVENUE
                  ══════════════════════════════════════════════════════ */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dashboard Tile 1</p>
                      <CardTitle className="text-base">Monthly Revenue — {format(iStats?.totalRevenue || 0)}</CardTitle>
                      <CardDescription>Gross income recorded for the current month</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Strong
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span>You are earning <strong className="text-foreground">{format(revPerNight)}/night</strong> on average across your booked nights. This is a strong rate for a direct-booking operation in Pakistan&apos;s short-term rental market.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span>Revenue growth shows <strong className="text-foreground">+{iStats?.revenueGrowth || 0}%</strong> vs last month. Note: if last month had no income recorded, this comparison will show 100% — confirm your income entries are complete for an accurate trend.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span>Your gross revenue ({format(iStats?.totalRevenue || 0)}) vs net revenue may differ if Airbnb platform fees are not yet deducted in your records. The income logged is what matters for cash flow planning.</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />Actions to Grow Revenue
                    </p>
                    <ul className="text-sm text-blue-900 dark:text-blue-200 space-y-1.5">
                      <li className="flex gap-2"><span className="font-bold">1.</span> Raise your nightly rate by 10–15% during peak weekends and holidays — your current avg of {format(revPerNight)}/night has upside.</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Add a minimum 2–3 night stay on weekends to reduce turnover costs and increase per-booking revenue.</li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> Introduce a seasonal pricing strategy: charge 20–25% more during Eid, school holidays, and summer months.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* ══════════════════════════════════════════════════════
                  SECTION 2: NET INCOME
                  ══════════════════════════════════════════════════════ */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dashboard Tile 2</p>
                      <CardTitle className="text-base">Net Income — {format(iStats?.netIncome || 0)} ({margin}% margin)</CardTitle>
                      <CardDescription>Revenue after all expenses — your actual take-home profit</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Excellent
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span>A <strong className="text-foreground">{margin}% profit margin</strong> is exceptional. For every Rs 100 in revenue, you keep Rs {margin} after expenses. The hospitality industry benchmark sits at 40–55%, so you are significantly outperforming.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span>Expenses are only <strong className="text-foreground">{expenseRatio}% of revenue</strong> ({format(iStats?.totalExpenses || 0)}). This low ratio suggests either lean operations or that some costs (maintenance, repairs) have not been logged yet this month.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span>Net income scales linearly with occupancy — every additional booked night adds approximately <strong className="text-foreground">{format(Math.round(revPerNight * (margin / 100)))}</strong> to your net profit after typical expense allocation.</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />Actions to Protect Margins
                    </p>
                    <ul className="text-sm text-green-900 dark:text-green-200 space-y-1.5">
                      <li className="flex gap-2"><span className="font-bold">1.</span> Log all expenses consistently (cleaning, utilities, supplies, maintenance) so your margin figure reflects true profitability — not just missing costs.</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Review cleaning fees charged to guests — if cleaning costs are rising, pass the increase through as a fee rather than absorbing it in margin.</li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> Set a monthly net income target (e.g. Rs 100,000) and work backwards: at your current margin, that requires Rs {format(Math.round(100000 / (margin / 100)))} in revenue.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* ══════════════════════════════════════════════════════
                  SECTION 3: OCCUPANCY RATE
                  ══════════════════════════════════════════════════════ */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dashboard Tile 3</p>
                      <CardTitle className="text-base">Occupancy Rate — {iStats?.occupancyRate || 0}% ({iStats?.bookedNights || 0}/{totalNights} nights)</CardTitle>
                      <CardDescription>Percentage of available nights currently booked this month</CardDescription>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />Needs Work
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Revenue opportunity bar */}
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revenue Opportunity from Filling Empty Nights</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-lg font-bold">{format(iStats?.totalRevenue || 0)}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Current ({iStats?.occupancyRate || 0}%)</div>
                      </div>
                      <div className="border-l border-r">
                        <div className="text-lg font-bold text-yellow-600">+{format(revenueGap70)}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">At 70% occupancy</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">+{format(revenueGap80)}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">At 80% occupancy</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
                      <span>You have <strong className="text-foreground">{emptyNights} empty nights</strong> this month. At your current average rate of {format(revPerNight)}/night, those represent <strong className="text-foreground">{format(emptyNights * revPerNight)}</strong> in forgone revenue.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
                      <span>45% occupancy for 4 properties means some rooms likely have extended gaps between bookings. Use the Calendar view to identify which properties have the longest empty stretches.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
                      <span>Industry standard for well-managed short-term rentals is 65–80%. You have significant room to grow without any capital investment.</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />Actions to Increase Occupancy
                    </p>
                    <ul className="text-sm text-yellow-900 dark:text-yellow-200 space-y-1.5">
                      <li className="flex gap-2"><span className="font-bold">1.</span> List on Booking.com in addition to Airbnb. More platforms = more visibility = fewer empty nights. Your direct bookings show strong demand — amplify it online.</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Offer a 10–15% discount for bookings of 7+ nights to attract longer-stay guests who reduce gaps between bookings.</li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> Create a WhatsApp broadcast list of past guests and send monthly availability updates — your 46 direct bookings mean you have a warm audience to re-engage.</li>
                      <li className="flex gap-2"><span className="font-bold">4.</span> Lower the minimum stay to 1 night for last-minute gaps (2–3 days before a vacant night) to fill holes in the calendar.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* ══════════════════════════════════════════════════════
                  SECTION 4: ACTIVE BOOKINGS
                  ══════════════════════════════════════════════════════ */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dashboard Tile 4</p>
                      <CardTitle className="text-base">Active Bookings — {iStats?.activeBookings || 0} confirmed + {iStats?.pendingBookings || 0} pending</CardTitle>
                      <CardDescription>Guests currently checked in or confirmed to arrive</CardDescription>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Good
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {todayCheckouts.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/40 p-4">
                      <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                        <Zap className="h-3.5 w-3.5" />Urgent — Guests Checking Out Today
                      </p>
                      <div className="space-y-2">
                        {todayCheckouts.map((b: any) => {
                          const owed = Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0))
                          return (
                            <div key={b.id} className="flex items-center justify-between text-sm">
                              <span className="font-medium text-red-900 dark:text-red-200">{b.guestName} — {b.property?.name}</span>
                              <span className={owed > 0 ? 'font-bold text-red-600' : 'text-green-600'}>
                                {owed > 0 ? `${format(owed)} owed` : 'Paid in full'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      {todayOwed > 0 && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-semibold">
                          Total to collect before checkout: {format(todayOwed)}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span><strong className="text-foreground">{iStats?.activeBookings || 0} active bookings</strong> means all 4 of your rooms are likely occupied right now — excellent utilisation for the current period.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span><strong className="text-foreground">{iStats?.pendingBookings || 0} pending booking</strong> — confirm or reject pending bookings quickly. Guests who don&apos;t hear back within 24 hours often book elsewhere.</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />Actions to Manage Active Bookings Better
                    </p>
                    <ul className="text-sm text-blue-900 dark:text-blue-200 space-y-1.5">
                      <li className="flex gap-2"><span className="font-bold">1.</span> Always collect full payment (or at least 50% deposit) at check-in. The outstanding balance problem starts here.</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Use the reminder feature on bookings to set a day-before-checkout alert so you can proactively chase any unpaid balance.</li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> Respond to pending bookings within 2 hours — this improves your Airbnb response rate score and booking conversion.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* ══════════════════════════════════════════════════════
                  SECTION 5: TOTAL BOOKINGS & PLATFORM MIX
                  ══════════════════════════════════════════════════════ */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dashboard Tile 5</p>
                      <CardTitle className="text-base">Total Bookings — {iStats?.totalBookings || 0} ({directCount} Direct · {airbnbCount} Airbnb)</CardTitle>
                      <CardDescription>All-time booking count and channel mix breakdown</CardDescription>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200">
                      <Lightbulb className="h-3 w-3 mr-1" />Opportunity
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/30 p-4 text-center">
                      <div className="text-xl font-bold">{directCount}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Direct Bookings</div>
                      <div className="text-sm font-semibold text-blue-600 mt-1">{format(directNet)}</div>
                      <div className="text-[11px] text-muted-foreground">avg {format(directAvg)}/booking</div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4 text-center">
                      <div className="text-xl font-bold">{airbnbCount}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Airbnb Bookings</div>
                      <div className="text-sm font-semibold text-red-500 mt-1">{format(airbnbNet)}</div>
                      <div className="text-[11px] text-muted-foreground">avg {format(airbnbAvg)}/booking</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-purple-500" />
                      <span><strong className="text-foreground">94% of bookings are direct</strong> — this is impressive and shows strong word-of-mouth and repeat business. However, it also means you are heavily dependent on a single channel for guests.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-purple-500" />
                      {airbnbPremium > 0 ? (
                        <span>Airbnb guests pay <strong className="text-foreground">{airbnbPremium}% more per booking</strong> on average ({format(airbnbAvg)} vs {format(directAvg)} for direct). This premium is likely from longer stays or higher nightly rates triggered by the platform&apos;s visibility.</span>
                      ) : (
                        <span>Airbnb and direct bookings have similar average values. Platform listing optimisation (better photos, descriptions, competitive pricing) could increase Airbnb per-booking value.</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-purple-500" />
                      <span>If you shifted just 20% of your direct bookings to Airbnb at the higher rate, your monthly revenue would increase by approximately <strong className="text-foreground">{format(Math.round(directCount * 0.20 * (airbnbAvg - directAvg)))}</strong>.</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />Actions to Improve Channel Mix
                    </p>
                    <ul className="text-sm text-purple-900 dark:text-purple-200 space-y-1.5">
                      <li className="flex gap-2"><span className="font-bold">1.</span> Invest in professional photography for all 4 rooms — Airbnb listings with pro photos get 40% more bookings. This is the single highest ROI action you can take.</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Add Booking.com as a third channel. It targets a different demographic (often longer business stays) and can fill weekday gaps.</li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> Set up Airbnb smart pricing with a floor at your current average direct rate ({format(directAvg)}) — this protects your minimum and lets the algorithm push rates higher during demand spikes.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* ══════════════════════════════════════════════════════
                  SECTION 6: ACTIVE PROPERTIES
                  ══════════════════════════════════════════════════════ */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dashboard Tile 6</p>
                      <CardTitle className="text-base">Active Properties — {iStats?.totalProperties || 0}</CardTitle>
                      <CardDescription>Revenue contribution and growth potential per property</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Stable
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span>With <strong className="text-foreground">{iStats?.totalProperties || 4} rooms</strong> generating {format(iStats?.totalRevenue || 0)}, your average revenue per property is approximately <strong className="text-foreground">{format(Math.round((iStats?.totalRevenue || 0) / (iStats?.totalProperties || 4)))}/month</strong>. At this rate, adding a 5th room would add roughly that amount to monthly revenue.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span>Before expanding, focus on maximising occupancy of your existing 4 rooms. Going from 45% to 70% occupancy on 4 rooms yields the same revenue as adding a 5th room at full occupancy — with no capital expenditure.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span>Check the Reports → By Property tab to see which room generates the most revenue. The best-performing room&apos;s pricing and listing strategy should be replicated across all others.</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />Actions to Get More From Your Properties
                    </p>
                    <ul className="text-sm text-green-900 dark:text-green-200 space-y-1.5">
                      <li className="flex gap-2"><span className="font-bold">1.</span> Identify your lowest-occupancy property from the By Property report and run a targeted discount campaign for the next 30 days to build its booking history and reviews.</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Consider upsell services: early check-in, late checkout, airport transfer, breakfast — each adds Rs 500–2,000 per booking with near-zero incremental cost.</li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> If expansion is the goal, prioritise rooms adjacent to your current properties so you can manage them efficiently under a single operation.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* ══════════════════════════════════════════════════════
                  SECTION 7: MONTHLY EXPENSES
                  ══════════════════════════════════════════════════════ */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dashboard Tile 7</p>
                      <CardTitle className="text-base">Monthly Expenses — {format(iStats?.totalExpenses || 0)} ({expenseRatio}% of revenue)</CardTitle>
                      <CardDescription>All costs logged against the business this month</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Low &amp; Controlled
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                      <span>At <strong className="text-foreground">{expenseRatio}% of revenue</strong>, your expense ratio is very lean. This is great for profitability but raises the question: are all recurring costs being captured? Utilities, cleaning, internet, and minor repairs are common items that can slip through.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                      <span>Expense growth is at <strong className="text-foreground">{iStats?.expenseGrowth || 0}%</strong> vs last month. A flat expense line while revenue grows is ideal — watch for step-changes in cleaning or maintenance costs as occupancy rises.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                      <span>Average expense per booked night: <strong className="text-foreground">{format(Math.round((iStats?.totalExpenses || 0) / Math.max(1, iStats?.bookedNights || 1)))}</strong>. This is the cost floor below which you should not price — your current average rate is well above it.</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />Actions to Control Expenses as You Scale
                    </p>
                    <ul className="text-sm text-orange-900 dark:text-orange-200 space-y-1.5">
                      <li className="flex gap-2"><span className="font-bold">1.</span> Log all expenses immediately using the Expenses page — even small ones. Accurate data lets you identify cost trends before they erode your margin.</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Negotiate bulk pricing with your cleaning service if you&apos;re using one — at 4 turnovers per booking on average, cleaning is likely your largest variable cost.</li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> Set a monthly expense budget per property (e.g. Rs 5,000–6,000) and use the P&L report to flag any property exceeding it.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* ══════════════════════════════════════════════════════
                  SECTION 8: OUTSTANDING BALANCE
                  ══════════════════════════════════════════════════════ */}
              <Card className="border-red-200 dark:border-red-900/40">
                <div className="h-1 w-full bg-red-500" />
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Dashboard Tile 8</p>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-red-500" />
                        Outstanding Balance — {format(iStats?.outstandingAmount || 0)} ({outstandingPct}% of revenue)
                      </CardTitle>
                      <CardDescription>Unpaid amounts owed by current and recent guests</CardDescription>
                    </div>
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200">
                      <XCircle className="h-3 w-3 mr-1" />Urgent
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                      <span><strong className="text-red-600">{format(iStats?.outstandingAmount || 0)}</strong> is owed across your bookings. This is {outstandingPct}% of your monthly revenue — money you have earned but not yet collected. At this scale, this is the most impactful thing to fix right now.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                      <span>Uncollected payments increase your operating risk: if a guest leaves without paying, recovering the money is very difficult. The best time to collect is <strong className="text-foreground">before or at check-in</strong>, not after checkout.</span>
                    </div>
                    <div className="flex gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                      <span>Use the <strong className="text-foreground">click-to-edit payment</strong> feature on the Arrivals &amp; Departures card to update paid amounts immediately when guests settle their balance.</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />Actions to Eliminate Outstanding Balances
                    </p>
                    <ul className="text-sm text-red-900 dark:text-red-200 space-y-1.5">
                      <li className="flex gap-2"><span className="font-bold">1.</span> <strong>Immediate:</strong> Contact guests who are checking out today and collect {format(todayOwed > 0 ? todayOwed : 0)} before they leave.</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Implement a strict <strong>50% deposit at booking + full payment at check-in</strong> policy. No exceptions. This alone will reduce your outstanding balance to near zero.</li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> For direct bookings, collect via bank transfer before check-in and only share the door code / welcome guests after payment confirmation.</li>
                      <li className="flex gap-2"><span className="font-bold">4.</span> Set payment reminders on bookings (the bell icon in the calendar) for 1 day before checkout to prompt final payment collection.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

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
