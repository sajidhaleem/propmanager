'use client'

import { useQuery } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, CalendarCheck, Building2,
  ArrowUpRight, Clock, AlertCircle, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { PlatformChart } from '@/components/dashboard/PlatformChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatDate, getStatusColor, getPlatformColor } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking } from '@/types'

async function fetchDashboardStats() {
  const res = await fetch('/api/dashboard/stats')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function DashboardPage() {
  const { format, currency } = useCurrency()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 2 * 60 * 1000,
  })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground text-sm">Failed to load dashboard.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" />Retry</Button>
      </div>
    )
  }

  const stats = data?.data?.stats
  const monthlyRevenue = data?.data?.monthlyRevenue || []
  const expensesByMonth = data?.data?.expensesByMonth || []
  const bookingsByPlatform = data?.data?.bookingsByPlatform || []
  const recentBookings: Booking[] = data?.data?.recentBookings || []

  const chartData = monthlyRevenue.map((r: any) => {
    const exp = expensesByMonth.find((e: any) => e.month === r.month)
    return { month: r.month, revenue: r.revenue, expenses: exp?.expenses || 0 }
  })

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">Here&apos;s what&apos;s happening with your properties today.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Card key={i} className="p-6"><Skeleton className="h-20" /></Card>)}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Monthly Revenue"   value={format(stats?.totalRevenue || 0)} change={stats?.revenueGrowth} icon={<DollarSign className="h-5 w-5" />} color="blue"   index={0} />
          <StatsCard title="Net Income"        value={format((stats?.totalRevenue||0)-(stats?.totalExpenses||0))} subtitle="After expenses" icon={<TrendingUp className="h-5 w-5" />} color="green"  index={1} />
          <StatsCard title="Occupancy Rate"    value={`${stats?.occupancyRate||0}%`} subtitle={`${stats?.bookedNights||0} nights booked`} icon={<CalendarCheck className="h-5 w-5" />} color="yellow" index={2} />
          <StatsCard title="Active Bookings"   value={stats?.activeBookings||0} subtitle={`${stats?.pendingBookings||0} pending`} icon={<Building2 className="h-5 w-5" />} color="purple" index={3} />
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Bookings',    value: stats?.totalBookings||0,          href: '/dashboard/bookings' },
            { label: 'Active Properties', value: stats?.totalProperties||0,        href: '/dashboard/properties' },
            { label: 'Monthly Expenses',  value: format(stats?.totalExpenses||0),  href: '/dashboard/expenses' },
            { label: 'Currency',          value: currency,                          href: '/dashboard/settings' },
          ].map((item) => (
            <Link key={item.label} href={item.href}>
              <div className="rounded-xl border bg-card px-4 py-3 hover:bg-accent/50 transition-colors group">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-lg font-bold">{item.value}</p>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? <Card><CardContent className="p-6"><Skeleton className="h-72" /></CardContent></Card>
            : <RevenueChart data={chartData} />}
        </div>
        <div>
          {isLoading ? <Card><CardContent className="p-6"><Skeleton className="h-72" /></CardContent></Card>
            : bookingsByPlatform.length > 0 ? <PlatformChart data={bookingsByPlatform} />
            : <Card className="flex items-center justify-center h-full min-h-[280px]"><p className="text-sm text-muted-foreground">No platform data yet</p></Card>}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Bookings</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/bookings" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-48" /></div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : recentBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarCheck className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No bookings yet</p>
              <Button size="sm" className="mt-4" asChild><Link href="/dashboard/bookings">Add Booking</Link></Button>
            </div>
          ) : (
            <div className="divide-y">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/40 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {b.guestName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.guestName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {b.property?.name} · <Clock className="h-3 w-3" /> {formatDate(b.checkIn, 'MMM d')} – {formatDate(b.checkOut, 'MMM d')}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <Badge className={getPlatformColor(b.platform)} variant="outline">{b.platform === 'BOOKING_COM' ? 'BDC' : b.platform}</Badge>
                    <Badge className={getStatusColor(b.status)} variant="outline">{b.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">{format(b.netAmount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
