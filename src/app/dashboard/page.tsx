'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Banknote, TrendingUp, CalendarCheck, Building2,
  ArrowUpRight, Clock, AlertCircle, RefreshCw, Check, X,
  BookOpen, CreditCard, Globe, CalendarPlus,
} from 'lucide-react'
import Link from 'next/link'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { PlatformChart } from '@/components/dashboard/PlatformChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, getStatusColor, getPlatformColor } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking } from '@/types'
import { EmptyState } from '@/components/ui/empty-state'
import toast from 'react-hot-toast'

async function fetchDashboardStats() {
  const res = await fetch('/api/dashboard/stats')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function DashboardPage() {
  const { format, currency } = useCurrency()
  const queryClient = useQueryClient()
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editingPaymentValue, setEditingPaymentValue] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 2 * 60 * 1000,
  })

  const paymentMutation = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setEditingPaymentId(null)
      toast.success('Payment updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function startEditPayment(b: Booking) {
    setEditingPaymentId(b.id)
    setEditingPaymentValue(String(b.rate))
  }

  function savePayment(id: string) {
    const val = parseFloat(editingPaymentValue)
    if (isNaN(val) || val < 0) { toast.error('Enter a valid amount'); return }
    paymentMutation.mutate({ id, rate: val })
  }

  function cancelEdit() {
    setEditingPaymentId(null)
    setEditingPaymentValue('')
  }

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
      {/* ── Greeting banner ── */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card px-6 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{greeting} 👋</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Here&apos;s what&apos;s happening with your properties today.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Card key={i} className="p-6"><Skeleton className="h-20" /></Card>)}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Monthly Revenue"   value={format(stats?.totalRevenue || 0)} change={stats?.revenueGrowth} icon={<Banknote className="h-5 w-5" />} color="blue"   index={0} />
          <StatsCard title="Net Income"        value={format((stats?.totalRevenue||0)-(stats?.totalExpenses||0))} subtitle="After expenses" icon={<TrendingUp className="h-5 w-5" />} color="green"  index={1} />
          <StatsCard title="Occupancy Rate"    value={`${stats?.occupancyRate||0}%`} subtitle={`${stats?.bookedNights||0} nights booked`} icon={<CalendarCheck className="h-5 w-5" />} color="yellow" index={2} />
          <StatsCard title="Active Bookings"   value={stats?.activeBookings||0} subtitle={`${stats?.pendingBookings||0} pending`} icon={<Building2 className="h-5 w-5" />} color="purple" index={3} />
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/dashboard/bookings" className="block hover:opacity-90 transition-opacity">
            <StatsCard title="Total Bookings"    value={stats?.totalBookings||0}         icon={<BookOpen className="h-5 w-5" />}   color="blue"   index={4} />
          </Link>
          <Link href="/dashboard/properties" className="block hover:opacity-90 transition-opacity">
            <StatsCard title="Active Properties" value={stats?.totalProperties||0}       icon={<Building2 className="h-5 w-5" />}  color="green"  index={5} />
          </Link>
          <Link href="/dashboard/expenses" className="block hover:opacity-90 transition-opacity">
            <StatsCard title="Monthly Expenses"  value={format(stats?.totalExpenses||0)} icon={<CreditCard className="h-5 w-5" />} color="red"    index={6} />
          </Link>
          <Link href="/dashboard/settings" className="block hover:opacity-90 transition-opacity">
            <StatsCard title="Currency"          value={currency}                         icon={<Globe className="h-5 w-5" />}      color="purple" index={7} />
          </Link>
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
          <div>
            <CardTitle className="text-base">Recent Bookings</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Click the amount to edit payment received</p>
          </div>
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
            <EmptyState
              icon={CalendarPlus}
              title="No bookings yet"
              description="Create your first booking to start tracking revenue and occupancy."
              action={{ label: 'Add Booking', onClick: () => window.location.href = '/dashboard/bookings' }}
            />
          ) : (
            <div className="divide-y">
              {recentBookings.map((b) => (
                <div key={b.id} className="relative flex items-center gap-4 px-6 py-3.5 hover:bg-muted/40 transition-colors group">
                  {/* Status accent left border */}
                  <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full opacity-70 ${
                    b.status === 'CONFIRMED'   ? 'bg-blue-500' :
                    b.status === 'CHECKED_IN'  ? 'bg-green-500' :
                    b.status === 'CHECKED_OUT' ? 'bg-purple-500' :
                    b.status === 'PENDING'     ? 'bg-yellow-500' :
                    b.status === 'CANCELLED'   ? 'bg-red-400' : 'bg-muted-foreground'
                  }`} />
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold ring-2 ring-primary/10">
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

                  {/* Inline payment edit */}
                  {editingPaymentId === b.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        value={editingPaymentValue}
                        onChange={(e) => setEditingPaymentValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') savePayment(b.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="h-7 w-24 text-xs text-right"
                        autoFocus
                      />
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700"
                        onClick={() => savePayment(b.id)}
                        disabled={paymentMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                        onClick={cancelEdit}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="text-sm font-semibold tabular-nums shrink-0 hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
                      title="Click to edit payment received"
                      onClick={() => startEditPayment(b)}
                    >
                      {format(b.rate)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
