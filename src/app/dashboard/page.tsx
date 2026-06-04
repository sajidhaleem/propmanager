'use client'

import { useQuery } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, CalendarCheck, Building2,
  ArrowUpRight, Clock, AlertCircle, RefreshCw,
} from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { PlatformChart } from '@/components/dashboard/PlatformChart'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, getStatusColor, getPlatformColor } from '@/lib/utils'
import { Booking } from '@/types'

async function fetchDashboardStats() {
  const res = await fetch('/api/dashboard/stats')
  if (!res.ok) throw new Error('Failed to load dashboard')
  return res.json()
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-3 w-24 mb-4" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </Card>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center">
          <p className="font-semibold">Failed to load dashboard</p>
          <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
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
          <p className="text-muted-foreground text-sm mt-1">
            Here's what's happening with your properties today.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      {isLoading ? <StatsSkeleton /> : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Monthly Revenue"
            value={formatCurrency(stats?.totalRevenue || 0)}
            change={stats?.revenueGrowth}
            icon={<DollarSign className="h-5 w-5" />}
            color="blue"
            index={0}
          />
          <StatsCard
            title="Net Income"
            value={formatCurrency((stats?.totalRevenue || 0) - (stats?.totalExpenses || 0))}
            subtitle="After expenses"
            icon={<TrendingUp className="h-5 w-5" />}
            color="green"
            index={1}
          />
          <StatsCard
            title="Occupancy Rate"
            value={`${stats?.occupancyRate || 0}%`}
            subtitle={`${stats?.bookedNights || 0} nights booked`}
            icon={<CalendarCheck className="h-5 w-5" />}
            color="yellow"
            index={2}
          />
          <StatsCard
            title="Active Bookings"
            value={stats?.activeBookings || 0}
            subtitle={`${stats?.pendingBookings || 0} pending approval`}
            icon={<Building2 className="h-5 w-5" />}
            color="purple"
            index={3}
          />
        </div>
      )}

      {/* Quick stats row */}
      {!isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { label: 'Total Bookings', value: stats?.totalBookings || 0, href: '/dashboard/bookings' },
            { label: 'Properties', value: stats?.totalProperties || 0, href: '/dashboard/properties' },
            { label: 'Monthly Expenses', value: formatCurrency(stats?.totalExpenses || 0), href: '/dashboard/expenses' },
            { label: 'Pending Payouts', value: '—', href: '/dashboard/payouts' },
          ].map((item) => (
            <Link key={item.label} href={item.href}>
              <div className="rounded-xl border bg-card px-4 py-3 hover:bg-accent/50 transition-colors group cursor-pointer">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-lg font-bold">{item.value}</p>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <Card className="p-6"><Skeleton className="h-72" /></Card>
          ) : (
            <RevenueChart data={chartData} />
          )}
        </div>
        <div>
          {isLoading ? (
            <Card className="p-6"><Skeleton className="h-72" /></Card>
          ) : bookingsByPlatform.length > 0 ? (
            <PlatformChart data={bookingsByPlatform} />
          ) : (
            <Card className="flex items-center justify-center h-full min-h-[280px]">
              <p className="text-sm text-muted-foreground">No platform data yet</p>
            </Card>
          )}
        </div>
      </div>

      {/* Recent bookings */}
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
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : recentBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                <CalendarCheck className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No bookings yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first booking to get started.</p>
              <Button size="sm" className="mt-4" asChild>
                <Link href="/dashboard/bookings">Add Booking</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/40 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {booking.guestName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{booking.guestName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{booking.property?.name}</span>
                      <span>·</span>
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(booking.checkIn, 'MMM d')} – {formatDate(booking.checkOut, 'MMM d')}</span>
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <Badge className={getPlatformColor(booking.platform)} variant="outline">
                      {booking.platform === 'BOOKING_COM' ? 'BDC' : booking.platform}
                    </Badge>
                    <Badge className={getStatusColor(booking.status)} variant="outline">
                      {booking.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {formatCurrency(booking.netAmount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
