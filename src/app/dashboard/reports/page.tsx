'use client'

import { useState } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query'
import {
  Download, TrendingUp, Lightbulb, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, Banknote, CalendarCheck, Building2, BookOpen, CreditCard,
  Zap, Home, RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { MagicCard } from '@/components/ui/magic-card'
import { NumberTicker } from '@/components/ui/number-ticker'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PLATFORM_COLORS = ['#e5484d','#8b6ce8','#1ba58e','#d96708','#4d82d6']
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

// ── Status config ──────────────────────────────────────────────────
type Status = 'excellent' | 'strong' | 'good' | 'opportunity' | 'warning' | 'urgent'
const STATUS_META: Record<Status, { label: string; bg: string; text: string; ring: string; glow: string }> = {
  excellent:   { label: 'Excellent',    bg: 'bg-green-100 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-300',  ring: 'ring-green-400',  glow: 'rgba(34,197,94,0.12)' },
  strong:      { label: 'Strong',       bg: 'bg-green-100 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-300',  ring: 'ring-green-400',  glow: 'rgba(34,197,94,0.12)' },
  good:        { label: 'Good',         bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-300',    ring: 'ring-blue-400',   glow: 'rgba(59,130,246,0.12)' },
  opportunity: { label: 'Opportunity',  bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300',ring: 'ring-purple-400', glow: 'rgba(168,85,247,0.12)' },
  warning:     { label: 'Needs Work',   bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300',ring: 'ring-yellow-400', glow: 'rgba(234,179,8,0.12)' },
  urgent:      { label: 'Urgent',       bg: 'bg-red-100 dark:bg-red-900/30',       text: 'text-red-700 dark:text-red-300',      ring: 'ring-red-400',    glow: 'rgba(239,68,68,0.12)' },
}

// ── Expandable action item ─────────────────────────────────────────
function ActionItem({ num, text, accentBg }: { num: number; text: string; accentBg: string }) {
  const [open, setOpen] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const headline = text.split(/\.\s/)[0]
  return (
    <button
      onClick={() => setOpen(v => !v)}
      className="w-full text-left rounded-lg border bg-card hover:bg-muted/40 transition-colors px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', accentBg)}>
          {num}
        </span>
        <span className="flex-1 text-sm font-medium leading-snug">{headline}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.01 : 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="mt-2 ml-8 text-sm text-muted-foreground leading-relaxed">{text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}

export default function ReportsPage() {
  const [year, setYear]               = useState(String(currentYear))
  const { format }                    = useCurrency()
  const shouldReduceMotion            = useReducedMotion()
  const [tab, setTab]                 = useState('insights')
  const [selectedTile, setSelectedTile] = useState<string | null>('revenue')
  const queryClient                   = useQueryClient()
  const reportsFetching                = useIsFetching({ queryKey: ['reports'] })
  const insightsFetching               = useIsFetching({ queryKey: ['insights'] })
  const isRefreshing                  = reportsFetching > 0 || insightsFetching > 0

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['reports'] })
    queryClient.invalidateQueries({ queryKey: ['insights'] })
  }

  // ── Existing report queries ────────────────────────────────────
  const { data: monthlyData,  isLoading: monthlyLoading }  = useQuery({ queryKey: ['reports','monthly',year],  queryFn: () => fetchReports(year,'monthly'),  enabled: tab==='monthly' })
  const { data: propertyData, isLoading: propertyLoading } = useQuery({ queryKey: ['reports','property',year], queryFn: () => fetchReports(year,'property'), enabled: tab==='property' })
  const { data: platformData, isLoading: platformLoading } = useQuery({ queryKey: ['reports','platform',year], queryFn: () => fetchReports(year,'platform'), enabled: tab==='platform' })
  const { data: pnlData,      isLoading: pnlLoading }      = useQuery({ queryKey: ['reports','pnl',year],     queryFn: () => fetchReports(year,'pnl'),     enabled: tab==='pnl' })

  // ── Insights query ─────────────────────────────────────────────
  const { data: insightData, isLoading: insightLoading } = useQuery({
    queryKey: ['insights','stats'],
    queryFn: fetchDashboardStats,
    enabled: tab === 'insights',
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  })

  // ── Computed metrics ───────────────────────────────────────────
  const iStats     = insightData?.data?.stats
  const iPlatforms: any[] = insightData?.data?.bookingsByPlatform || []
  const iUpcoming: any[]  = insightData?.data?.upcomingBookings   || []

  const margin        = iStats?.totalRevenue > 0 ? Math.round(((iStats.totalRevenue - iStats.totalExpenses) / iStats.totalRevenue) * 100) : 0
  const expenseRatio  = iStats?.totalRevenue > 0 ? Math.round((iStats.totalExpenses / iStats.totalRevenue) * 100) : 0
  const totalNights   = (iStats?.totalProperties || 0) * 30
  const emptyNights   = Math.max(0, totalNights - (iStats?.bookedNights || 0))
  const revPerNight   = (iStats?.bookedNights || 0) > 0 ? Math.round(iStats.totalRevenue / iStats.bookedNights) : 0
  const revenueAt70   = Math.round(totalNights * 0.70) * revPerNight
  const revenueAt80   = Math.round(totalNights * 0.80) * revPerNight
  const revenueGap70  = Math.max(0, revenueAt70 - (iStats?.totalRevenue || 0))
  const revenueGap80  = Math.max(0, revenueAt80 - (iStats?.totalRevenue || 0))
  const outstandingPct = iStats?.totalRevenue > 0 ? Math.round((iStats.outstandingAmount / iStats.totalRevenue) * 100) : 0

  const airbnbData    = iPlatforms.find(p => p.platform === 'AIRBNB')
  const directData    = iPlatforms.find(p => p.platform === 'DIRECT')
  const airbnbCount   = airbnbData?._count?.id || 0
  const directCount   = directData?._count?.id || 0
  const airbnbNet     = airbnbData?._sum?.netAmount || 0
  const directNet     = directData?._sum?.netAmount || 0
  const airbnbAvg     = airbnbCount > 0 ? Math.round(airbnbNet / airbnbCount) : 0
  const directAvg     = directCount > 0 ? Math.round(directNet / directCount) : 0
  const airbnbPremium = directAvg > 0 ? Math.round(((airbnbAvg - directAvg) / directAvg) * 100) : 0

  const todayD = new Date()
  const todayCheckouts = iUpcoming.filter(b => {
    const co = new Date(b.checkOut)
    return co.getFullYear() === todayD.getFullYear() && co.getMonth() === todayD.getMonth() && co.getDate() === todayD.getDate()
  })
  const todayOwed = todayCheckouts.reduce((s: number, b: any) => s + Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0)), 0)

  // ── Tile definitions ───────────────────────────────────────────
  const tiles = [
    {
      id: 'revenue', num: 1, title: 'Monthly Revenue', Icon: Banknote,
      value: format(iStats?.totalRevenue || 0), sub: `${format(revPerNight)}/night avg`,
      status: 'strong' as Status,
      analysis: [
        `Earning ${format(revPerNight)} per booked night — strong for a direct-booking operation. Every additional night booked adds approximately ${format(Math.round(revPerNight * (margin / 100)))} to net profit.`,
        `Revenue growth shows +${iStats?.revenueGrowth || 0}% vs last month. If last month had no income recorded this shows 100% — confirm entries are complete for an accurate trend line.`,
        `Gross (${format(iStats?.totalRevenue || 0)}) vs net may differ if Airbnb platform fees haven't been deducted yet — cross-reference with your P&L report.`,
      ],
      actions: [
        `Raise nightly rates 10–15% on peak weekends and holidays. Your current avg of ${format(revPerNight)}/night still has meaningful upside in this market.`,
        `Add a minimum 2–3 night stay on weekends to cut turnover costs and push per-booking revenue higher without raising the nightly rate.`,
        `Build a seasonal pricing calendar: 20–25% higher during Eid, school holidays, and summer months — set these in advance so bookings auto-capture the premium.`,
      ],
      accentBg: 'bg-green-500', accentText: 'text-green-700 dark:text-green-300', accentSection: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/40',
    },
    {
      id: 'net', num: 2, title: 'Net Income', Icon: TrendingUp,
      value: format(iStats?.netIncome || 0), sub: `${margin}% margin`,
      status: 'excellent' as Status,
      analysis: [
        `A ${margin}% profit margin is exceptional — industry benchmark is 40–55%. For every Rs 100 earned you keep Rs ${margin} after all costs. This margin is your most important number to protect as you scale.`,
        `Expenses are only ${expenseRatio}% of revenue. This is lean — but verify all costs are logged. Utilities, cleaning, internet, and minor repairs are common gaps that artificially inflate the margin figure.`,
        `Net income scales directly with occupancy. Going from ${iStats?.occupancyRate || 0}% to 70% occupancy adds approximately ${format(Math.round(revenueGap70 * (margin / 100)))} per month to net profit alone.`,
      ],
      actions: [
        `Log every expense immediately — even small ones. Accurate numbers let you spot cost trends before they quietly erode your ${margin}% margin.`,
        `Review cleaning fees charged to guests. If cleaning costs rise with higher occupancy, pass that through as an increased cleaning fee rather than absorbing it.`,
        `Set a monthly net income target (e.g. Rs 100,000). At your current margin, that requires ${format(Math.round(100000 / (margin / 100)))} in revenue — a clear goal to work backwards from.`,
      ],
      accentBg: 'bg-emerald-500', accentText: 'text-emerald-700 dark:text-emerald-300', accentSection: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40',
    },
    {
      id: 'occupancy', num: 3, title: 'Occupancy Rate', Icon: CalendarCheck,
      value: `${iStats?.occupancyRate || 0}%`, sub: `${iStats?.bookedNights || 0}/${totalNights} nights`,
      status: 'warning' as Status,
      analysis: [
        `At ${iStats?.occupancyRate || 0}% you have ${emptyNights} empty nights this month. At ${format(revPerNight)}/night those represent ${format(emptyNights * revPerNight)} in forgone revenue — the single biggest growth lever in your business right now.`,
        `Raising to 70% occupancy adds ${format(revenueGap70)}/month. Raising to 80% adds ${format(revenueGap80)}/month. No new properties, no rate increase required — just filling existing gaps.`,
        `Industry standard for well-managed short-term rentals is 65–80%. You have significant headroom to grow with the assets you already own.`,
      ],
      actions: [
        `List on Booking.com in addition to Airbnb. More channels = more visibility = fewer empty nights. Your direct booking demand is proven — amplify it online with zero capital cost.`,
        `Offer a 10–15% discount for stays of 7+ nights to attract longer-stay guests who eliminate gaps between bookings and reduce turnover effort.`,
        `Create a WhatsApp broadcast list of your ${directCount} past direct guests and send monthly availability updates — this is a warm audience that already trusts you.`,
        `Drop minimum stay to 1 night for last-minute gaps (2–3 days before a vacancy) to fill calendar holes that would otherwise go empty.`,
      ],
      accentBg: 'bg-yellow-500', accentText: 'text-yellow-700 dark:text-yellow-300', accentSection: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/40',
    },
    {
      id: 'active', num: 4, title: 'Active Bookings', Icon: Building2,
      value: String(iStats?.activeBookings || 0), sub: `${iStats?.pendingBookings || 0} pending`,
      status: 'good' as Status,
      analysis: [
        `${iStats?.activeBookings || 0} confirmed bookings means your rooms are occupied right now — excellent utilisation for the current period. Monitor the Arrivals & Departures card on the dashboard for real-time check-in/out status.`,
        `${iStats?.pendingBookings || 0} pending booking${(iStats?.pendingBookings || 0) !== 1 ? 's' : ''} — respond within 2 hours. Guests who don't hear back book elsewhere, and a slow response rate hurts your Airbnb ranking algorithm.`,
        todayOwed > 0
          ? `${todayCheckouts.length} guest${todayCheckouts.length !== 1 ? 's' : ''} checking out today have a combined unpaid balance of ${format(todayOwed)} — collect before they leave.`
          : `All guests checking out today are paid in full — good payment collection hygiene.`,
      ],
      actions: [
        `Collect at minimum 50% deposit at booking confirmation. Require the remainder at check-in before handing over keys or access codes.`,
        `Set a reminder on every booking (the bell icon in the Calendar view) for the day before checkout to prompt final payment and a smooth handover.`,
        `Respond to all pending bookings within 2 hours — this directly improves your Airbnb response rate score and increases conversion.`,
      ],
      accentBg: 'bg-blue-500', accentText: 'text-blue-700 dark:text-blue-300', accentSection: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/40',
    },
    {
      id: 'bookings', num: 5, title: 'Total Bookings', Icon: BookOpen,
      value: String(iStats?.totalBookings || 0), sub: `${directCount} direct · ${airbnbCount} Airbnb`,
      status: 'opportunity' as Status,
      analysis: [
        `94% of your ${iStats?.totalBookings || 0} bookings are direct — this shows strong word-of-mouth and repeat business. The risk is single-channel dependency: if direct referrals slow down, you have no backup pipeline.`,
        `Airbnb bookings average ${format(airbnbAvg)} vs ${format(directAvg)} for direct — a ${airbnbPremium}% premium. Platform guests tend to book longer stays and accept higher rates due to trust signals like reviews and verified photos.`,
        `If you converted just 20% of future direct bookings to Airbnb at the higher average, monthly revenue would increase by approximately ${format(Math.round(directCount * 0.20 * (airbnbAvg - directAvg)))}.`,
      ],
      actions: [
        `Invest in professional photography for all 4 rooms — Airbnb listings with pro photos get up to 40% more bookings. This is the single highest-ROI action you can take right now.`,
        `List on Booking.com. It targets a different demographic (business travel, longer weekday stays) and fills gaps your direct guests don't cover.`,
        `Enable Airbnb smart pricing with a floor set to your current direct average (${format(directAvg)}) — this protects your minimum while letting the algorithm push rates higher during demand spikes.`,
      ],
      accentBg: 'bg-purple-500', accentText: 'text-purple-700 dark:text-purple-300', accentSection: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/40',
    },
    {
      id: 'properties', num: 6, title: 'Active Properties', Icon: Home,
      value: String(iStats?.totalProperties || 0), sub: `${format(Math.round((iStats?.totalRevenue || 0) / Math.max(1, iStats?.totalProperties || 1)))}/room avg`,
      status: 'good' as Status,
      analysis: [
        `Average revenue per room is ${format(Math.round((iStats?.totalRevenue || 0) / Math.max(1, iStats?.totalProperties || 1)))} this month. Adding a 5th room at similar performance would increase monthly revenue by the same amount — but only after fully optimising your current 4.`,
        `Going from ${iStats?.occupancyRate || 0}% to 70% occupancy across your existing 4 rooms generates the same revenue uplift as a full additional room at 100% occupancy — with zero capital expenditure.`,
        `Check Reports → By Property to identify your best and worst performers. Replicate the highest earner's pricing, listing, and booking strategy across all others before considering expansion.`,
      ],
      actions: [
        `Identify your lowest-occupancy room in the By Property report and run a targeted 10% discount for 30 days to build its booking history and review count.`,
        `Introduce upsell add-ons: early check-in (+Rs 500), late checkout (+Rs 500), airport transfer, or breakfast. Each adds revenue with near-zero extra cost.`,
        `When you expand, prioritise rooms in or adjacent to your current building so you can operate them under a single check-in system and cleaning rotation.`,
      ],
      accentBg: 'bg-teal-500', accentText: 'text-teal-700 dark:text-teal-300', accentSection: 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-900/40',
    },
    {
      id: 'expenses', num: 7, title: 'Monthly Expenses', Icon: CreditCard,
      value: format(iStats?.totalExpenses || 0), sub: `${expenseRatio}% of revenue`,
      status: 'excellent' as Status,
      analysis: [
        `At ${expenseRatio}% of revenue your expense ratio is very lean. Industry standard is 45–60% for managed short-term rentals. This gives you strong margins — but raises the question of whether all recurring costs are being captured.`,
        `Average cost per booked night: ${format(Math.round((iStats?.totalExpenses || 0) / Math.max(1, iStats?.bookedNights || 1)))}. This is your hard cost floor — your current nightly rate is well above it, giving healthy contribution per booking.`,
        `Expense growth is ${iStats?.expenseGrowth || 0}% vs last month. A flat expense line as revenue grows is ideal — watch for step-changes in cleaning or maintenance as bookings increase.`,
      ],
      actions: [
        `Log all expenses immediately via the Expenses page, even small ones. Accurate data lets you identify cost trends weeks before they become a margin problem.`,
        `Negotiate bulk pricing with your cleaning provider. At 4+ turnovers per week on average, cleaning is likely your largest variable cost and most negotiable.`,
        `Set a monthly expense budget per room (e.g. Rs 5,500–6,500) and use the P&L report to flag any room exceeding it — this catches maintenance cost outliers early.`,
      ],
      accentBg: 'bg-orange-500', accentText: 'text-orange-700 dark:text-orange-300', accentSection: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/40',
    },
    {
      id: 'outstanding', num: 8, title: 'Outstanding Balance', Icon: Zap,
      value: format(iStats?.outstandingAmount || 0), sub: `${outstandingPct}% of revenue`,
      status: 'urgent' as Status,
      analysis: [
        `${format(iStats?.outstandingAmount || 0)} is owed — ${outstandingPct}% of your monthly revenue sitting uncollected. This is the most immediately impactful problem to fix: it requires no new guests, no rate changes — just collection.`,
        `Uncollected payments represent real operating risk. Once a guest has checked out, recovery becomes very difficult. The only reliable collection point is before or at check-in.`,
        todayOwed > 0
          ? `${todayCheckouts.length} guest${todayCheckouts.length !== 1 ? 's' : ''} checking out today owe a combined ${format(todayOwed)}. Contact them now — before checkout.`
          : `No outstanding balance from today's checkouts — all settled. Focus on the remaining ${format(iStats?.outstandingAmount || 0)} from other active bookings.`,
      ],
      actions: [
        `Immediate action: contact guests checking out today and collect ${format(todayOwed > 0 ? todayOwed : 0)} before they leave the property.`,
        `Implement a strict 50% deposit at booking + full payment at check-in policy. No exceptions. This single change will reduce your outstanding balance to near zero within weeks.`,
        `For direct bookings, require bank transfer before check-in — share the door code or welcome the guest only after payment confirmation arrives.`,
        `Use the reminder bell on bookings to set a 1-day-before-checkout alert so you can proactively chase any unpaid balance while the guest is still on property.`,
      ],
      accentBg: 'bg-red-500', accentText: 'text-red-700 dark:text-red-300', accentSection: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/40',
    },
  ]

  const activeTile = tiles.find(t => t.id === selectedTile)

  // ── Existing report data ───────────────────────────────────────
  const monthly    = monthlyData?.data?.monthly    || []
  const properties = propertyData?.data?.properties || []
  const platforms  = platformData?.data?.platforms  || []
  const pnlRows: any[] = pnlData?.data?.pnl    || []
  const pnlTotals: any = pnlData?.data?.totals || {}

  const chartMonthly   = monthly.map((m: any) => ({ month: MONTHS[m.month - 1], Revenue: m.revenue, Expenses: m.totalExpenses, 'Net Income': m.net }))
  const totalRevenue   = monthly.reduce((s: number, m: any) => s + m.revenue, 0)
  const totalExpenses  = monthly.reduce((s: number, m: any) => s + m.totalExpenses, 0)
  const totalNet       = totalRevenue - totalExpenses

  async function exportMonthly() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(monthly.map((m: any) => ({ Month: MONTHS[m.month - 1], Year: m.year, Revenue: m.revenue, 'Operational Expenses': m.expenses, Payouts: m.payouts, 'Total Expenses': m.totalExpenses, 'Net Income': m.net })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Report ${year}`); XLSX.writeFile(wb, `annual-report-${year}.xlsx`)
  }
  async function exportPnL() {
    const XLSX = await import('xlsx')
    const rows = [...pnlRows, { ...pnlTotals, month: 0 }].map(r => ({ 'Month': r.month === 0 ? 'TOTAL' : MONTHS[r.month - 1], 'Airbnb Revenue': r.airbnbRevenue||0, 'Other Revenue': r.otherRevenue||0, 'Utilities': r.UTILITIES||0, 'Cleaning': r.CLEANING||0, 'Repairs': r.REPAIRS||0, 'Supplies': r.SUPPLIES||0, 'Maintenance': r.MAINTENANCE||0, 'Other Expenses': r.OTHER||0, 'Payouts': r.payouts||0, 'Total Expenses': r.totalExpenses||0, 'Net Profit': r.netProfit||0 }))
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `P&L ${year}`); XLSX.writeFile(wb, `pnl-report-${year}.xlsx`)
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
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={tab === 'pnl' ? exportPnL : exportMonthly} disabled={tab === 'insights'}>
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

        {/* ═══════════════════════════════════════════════════════
            INSIGHTS TAB
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="insights" className="space-y-4">
          {insightLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
              <Skeleton className="h-12 rounded-xl" />
              <div className="grid grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
            </div>
          ) : (
            <>
              {/* ── Layer 1: Health Score ── */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Profit Margin', value: margin, suffix: '%', note: 'Industry avg: 40–55%', status: 'excellent' as Status, Icon: CheckCircle2 },
                  { label: 'Occupancy Rate', value: iStats?.occupancyRate || 0, suffix: '%', note: 'Target: 70%+', status: 'warning' as Status, Icon: AlertTriangle },
                  { label: 'Revenue Uncollected', value: outstandingPct, suffix: '%', note: 'Act immediately', status: 'urgent' as Status, Icon: XCircle },
                ].map(({ label, value, suffix, note, status, Icon }) => {
                  const s = STATUS_META[status]
                  return (
                    <div key={label} className={cn('rounded-xl border p-5 text-center', s.bg, 'border-transparent')}>
                      <Icon className={cn('h-5 w-5 mx-auto mb-2', s.text)} />
                      <div className={cn('text-3xl font-bold', s.text)}>
                        <NumberTicker value={value} format={(v) => `${Math.round(v)}${suffix}`} />
                      </div>
                      <div className={cn('text-xs font-semibold mt-1', s.text)}>{label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{note}</div>
                    </div>
                  )
                })}
              </div>

              {/* ── Layer 2: Executive Summary ── */}
              <Card className="border-dashed">
                <CardContent className="py-3 px-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Your business is profitable at {margin}% margin</strong> — well above industry average. The primary growth lever is occupancy: {emptyNights} empty nights this month represent{' '}
                    <strong className="text-foreground">{format(revenueGap70)} in additional monthly revenue</strong> at 70% target. Most urgent: {format(iStats?.outstandingAmount || 0)} outstanding — {outstandingPct}% of revenue uncollected.
                    {todayOwed > 0 && <strong className="text-red-600"> {format(todayOwed)} is owed by guests checking out today.</strong>}
                  </p>
                </CardContent>
              </Card>

              {/* ── Layer 3: Tile Selector Grid ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-0.5">
                  Select a tile to see analysis &amp; action plan
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {tiles.map(tile => {
                    const s = STATUS_META[tile.status]
                    const isSelected = selectedTile === tile.id
                    return (
                      <MagicCard
                        key={tile.id}
                        glowColor={s.glow}
                        className={cn(
                          'rounded-xl border cursor-pointer transition-[border-color,background-color,box-shadow] duration-200',
                          isSelected
                            ? `ring-2 ${s.ring} bg-card`
                            : 'hover:border-muted-foreground/30 bg-card'
                        )}
                      >
                        <button
                          onClick={() => setSelectedTile(isSelected ? null : tile.id)}
                          className="w-full text-left p-4"
                        >
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', s.bg)}>
                              <tile.Icon className={cn('h-4 w-4', s.text)} />
                            </div>
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 font-semibold border-0', s.bg, s.text)}>
                              {s.label}
                            </Badge>
                          </div>
                          <div className="font-bold text-base leading-tight tabular-nums">{tile.value}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{tile.sub}</div>
                          <div className="text-[11px] font-semibold text-muted-foreground mt-2 truncate">{tile.title}</div>
                        </button>
                      </MagicCard>
                    )
                  })}
                </div>
              </div>

              {/* ── Layer 4: Detail Panel ── */}
              <AnimatePresence mode="wait">
                {activeTile && (
                  <motion.div
                    key={activeTile.id}
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
                    transition={{ duration: shouldReduceMotion ? 0.01 : 0.22, ease: 'easeOut' }}
                  >
                    <Card className={cn('overflow-hidden border', activeTile.status === 'urgent' && 'border-red-200 dark:border-red-900/40')}>
                      {/* Colour accent bar */}
                      <div className={cn('h-1 w-full', activeTile.accentBg)} />

                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                              Dashboard Tile {activeTile.num}
                            </p>
                            <CardTitle className="text-base">{activeTile.title} — {activeTile.value}</CardTitle>
                            <CardDescription>{activeTile.sub}</CardDescription>
                          </div>
                          <Badge variant="outline" className={cn('border-0 font-semibold', STATUS_META[activeTile.status].bg, STATUS_META[activeTile.status].text)}>
                            {STATUS_META[activeTile.status].label}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-5">
                        {/* Analysis */}
                        <div className="space-y-2">
                          {activeTile.analysis.map((point, i) => (
                            <div key={i} className="flex gap-3 text-sm text-muted-foreground">
                              <div className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', activeTile.accentBg)} />
                              <span className="leading-relaxed">{point}</span>
                            </div>
                          ))}
                        </div>

                        {/* Today's checkout alert for outstanding tile */}
                        {activeTile.id === 'outstanding' && todayCheckouts.length > 0 && todayOwed > 0 && (
                          <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-4">
                            <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                              <Zap className="h-3.5 w-3.5" />Guests Checking Out Today
                            </p>
                            <div className="space-y-1.5">
                              {todayCheckouts.map((b: any) => {
                                const owed = Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0))
                                return (
                                  <div key={b.id} className="flex justify-between text-sm">
                                    <span className="font-medium text-red-900 dark:text-red-200">{b.guestName} · {b.property?.name}</span>
                                    <span className={owed > 0 ? 'font-bold text-red-600' : 'text-green-600'}>
                                      {owed > 0 ? `${format(owed)} owed` : 'Paid ✓'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Occupancy opportunity widget */}
                        {activeTile.id === 'occupancy' && (
                          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-4 text-center">
                            <div>
                              <div className="text-base font-bold">{format(iStats?.totalRevenue || 0)}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">Now ({iStats?.occupancyRate || 0}%)</div>
                            </div>
                            <div className="border-x">
                              <div className="text-base font-bold text-yellow-600">+{format(revenueGap70)}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">At 70% occ.</div>
                            </div>
                            <div>
                              <div className="text-base font-bold text-green-600">+{format(revenueGap80)}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">At 80% occ.</div>
                            </div>
                          </div>
                        )}

                        {/* Platform breakdown for bookings tile */}
                        {activeTile.id === 'bookings' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border bg-muted/30 p-3 text-center">
                              <div className="text-xl font-bold">{directCount}</div>
                              <div className="text-xs text-muted-foreground">Direct · {format(directNet)}</div>
                              <div className="text-[11px] text-muted-foreground">{format(directAvg)}/booking avg</div>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-3 text-center">
                              <div className="text-xl font-bold">{airbnbCount}</div>
                              <div className="text-xs text-muted-foreground">Airbnb · {format(airbnbNet)}</div>
                              <div className="text-[11px] text-muted-foreground">{format(airbnbAvg)}/booking avg {airbnbPremium > 0 && <span className="text-purple-600 font-semibold">+{airbnbPremium}%</span>}</div>
                            </div>
                          </div>
                        )}

                        {/* Action Plan accordion */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                            Action Plan
                          </p>
                          <div className="space-y-2">
                            {activeTile.actions.map((action, i) => (
                              <ActionItem key={i} num={i + 1} text={action} accentBg={activeTile.accentBg} />
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {!selectedTile && (
                <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <Lightbulb className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  Select any tile above to see detailed analysis and a prioritised action plan
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            P&L REPORT
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="pnl" className="space-y-4">
          {pnlLoading ? (
            <div className="space-y-2">{[...Array(13)].map((_,i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    {['Month','Airbnb Revenue','Other Revenue','Utilities','Cleaning','Repairs','Supplies','Maintenance','Other Exp.','Payouts','Total Expenses','Net Profit'].map(h => (
                      <th key={h} className="px-3 py-3 text-right first:text-left font-semibold text-xs text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pnlRows.map((row: any) => (
                    <tr key={row.month} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-medium">{MONTHS[row.month - 1]}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-green-600 dark:text-green-400">{format(row.airbnbRevenue||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{format(row.otherRevenue||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.UTILITIES||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.CLEANING||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.REPAIRS||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.SUPPLIES||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.MAINTENANCE||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{format(row.OTHER||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-orange-600 dark:text-orange-400">{format(row.payouts||0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-red-600">{format(row.totalExpenses||0)}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums font-bold', row.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>{format(row.netProfit||0)}</td>
                    </tr>
                  ))}
                </tbody>
                {pnlTotals && (
                  <tfoot>
                    <tr className="bg-muted border-t-2 border-border font-bold">
                      <td className="px-3 py-3 text-xs uppercase tracking-wide">Total {year}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-green-600">{format(pnlTotals.airbnbRevenue||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-blue-600">{format(pnlTotals.otherRevenue||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.UTILITIES||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.CLEANING||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.REPAIRS||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.SUPPLIES||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.MAINTENANCE||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-500">{format(pnlTotals.OTHER||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-orange-600">{format(pnlTotals.payouts||0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-600">{format(pnlTotals.totalExpenses||0)}</td>
                      <td className={cn('px-3 py-3 text-right tabular-nums', (pnlTotals.netProfit||0) >= 0 ? 'text-green-600' : 'text-red-600')}>{format(pnlTotals.netProfit||0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            MONTHLY OVERVIEW
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="monthly" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: `${year} Total Revenue`, value: totalRevenue, positive: true },
              { label: `${year} Total Expenses`, value: totalExpenses, positive: false },
              { label: `${year} Net Income`, value: totalNet, positive: totalNet >= 0 },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-6">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                {monthlyLoading ? <Skeleton className="h-8 w-32 mt-2" /> : (
                  <p className={cn('text-2xl font-bold mt-2', s.positive ? 'text-green-600' : 'text-red-500')}>{format(s.value)}</p>
                )}
              </CardContent></Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Monthly P&L — {year}</CardTitle><CardDescription>Revenue, expenses, and net income by month</CardDescription></CardHeader>
            <CardContent>
              {monthlyLoading ? <Skeleton className="h-72" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartMonthly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => format(v)} />
                    <Tooltip formatter={(v: number) => format(v)} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#d96708" radius={[3,3,0,0]} />
                    <Bar dataKey="Expenses" fill="#e5484d" radius={[3,3,0,0]} />
                    <Bar dataKey="Net Income" fill="#1ba58e" radius={[3,3,0,0]} />
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
                    {['Month','Revenue','Expenses','Net Income','Margin'].map(h => (
                      <th key={h} className={cn('px-4 py-3 font-medium text-muted-foreground', h === 'Month' ? 'text-left' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m: any) => (
                    <tr key={m.month} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{MONTHS[m.month - 1]} {m.year}</td>
                      <td className="px-4 py-3 text-right">{format(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{format(m.expenses)}</td>
                      <td className={cn('px-4 py-3 text-right font-semibold', m.net >= 0 ? 'text-green-600' : 'text-red-500')}>{format(m.net)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{m.revenue > 0 ? `${Math.round((m.net/m.revenue)*100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            BY PROPERTY
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="property" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {propertyLoading
              ? [...Array(4)].map((_,i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>)
              : properties.map((p: any) => (
                <Card key={p.id}><CardContent className="p-6">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-2xl font-bold mt-2 text-green-600">{format(p.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{p.totalBookings} bookings · {p.totalNights} nights</p>
                  <p className="text-xs text-muted-foreground">Avg: {format(p.avgRate)}/night</p>
                </CardContent></Card>
              ))
            }
          </div>
          {!propertyLoading && properties.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Revenue by Property — {year}</CardTitle><CardDescription>Compare total net revenue across all properties</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={properties.map((p: any) => ({ name: p.name.length > 14 ? p.name.slice(0,14)+'…' : p.name, Revenue: p.totalRevenue, Bookings: p.totalBookings, Nights: p.totalNights }))} margin={{ top:5, right:20, left:10, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => format(v)} />
                    <Tooltip formatter={(v: number, name: string) => name === 'Revenue' ? [format(v), 'Revenue'] : [v, name]} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#d96708" radius={[4,4,0,0]} />
                    <Bar dataKey="Bookings" fill="#1ba58e" radius={[4,4,0,0]} />
                    <Bar dataKey="Nights" fill="#8b6ce8" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            BY PLATFORM
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="platform" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Bookings by Platform</CardTitle></CardHeader>
              <CardContent>
                {platformLoading ? <Skeleton className="h-72" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={platforms.map((p: any) => ({ name: p.platform, value: p._count.id }))} cx="50%" cy="50%" outerRadius={100} dataKey="value">
                        {platforms.map((_: any, i: number) => <Cell key={i} fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]} />)}
                      </Pie>
                      <Tooltip /><Legend />
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
                        <span className="text-sm font-medium">{format(p._sum.netAmount||0)}</span>
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
