'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, parseISO,
  addMonths, subMonths,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { Booking } from '@/types'
import Link from 'next/link'

async function fetchCalendarBookings(startDate: string, endDate: string) {
  const res = await fetch(`/api/bookings?startDate=${startDate}&endDate=${endDate}&limit=300`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

const STATUS_BAR: Record<string, string> = {
  PENDING:     'bg-yellow-400 text-yellow-950',
  CONFIRMED:   'bg-blue-500 text-white',
  CHECKED_IN:  'bg-green-500 text-white',
  CHECKED_OUT: 'bg-purple-500 text-white',
  CANCELLED:   'bg-red-400/70 text-white line-through',
  NO_SHOW:     'bg-gray-400/70 text-white',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:     'Pending',
  CONFIRMED:   'Confirmed',
  CHECKED_IN:  'Checked in',
  CHECKED_OUT: 'Checked out',
  CANCELLED:   'Cancelled',
  NO_SHOW:     'No show',
}

const LEGEND = [
  { label: 'Pending',      color: 'bg-yellow-400' },
  { label: 'Confirmed',    color: 'bg-blue-500' },
  { label: 'Checked in',   color: 'bg-green-500' },
  { label: 'Checked out',  color: 'bg-purple-500' },
  { label: 'Cancelled',    color: 'bg-red-400/70' },
]

const DAY_HEADERS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_HEADERS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd })

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', format(monthStart, 'yyyy-MM')],
    queryFn: () => fetchCalendarBookings(
      format(calStart, 'yyyy-MM-dd'),
      format(calEnd, 'yyyy-MM-dd'),
    ),
  })

  const bookings: Booking[] = data?.data?.data || []

  function getBookingsForDay(day: Date) {
    return bookings.filter(b => {
      const ci = parseISO(b.checkIn)
      const co = parseISO(b.checkOut)
      const ciDay = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate())
      const coDay = new Date(co.getFullYear(), co.getMonth(), co.getDate())
      const d    = new Date(day.getFullYear(), day.getMonth(), day.getDate())
      return d >= ciDay && d <= coDay
    })
  }

  const weeks: Date[][] = []
  for (let i = 0; i < calDays.length; i += 7) weeks.push(calDays.slice(i, i + 7))

  const today = new Date()
  const totalBookingsThisMonth = bookings.filter(b =>
    isSameMonth(parseISO(b.checkIn), currentDate)
  ).length

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description={`${totalBookingsThisMonth} booking${totalBookingsThisMonth !== 1 ? 's' : ''} in ${format(currentDate, 'MMMM yyyy')}`}>
        <Button size="sm" asChild>
          <Link href="/dashboard/bookings"><Plus className="h-4 w-4" />New Booking</Link>
        </Button>
      </PageHeader>

      <Card className="overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{format(subMonths(currentDate, 1), 'MMM')}</span>
          </Button>

          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">{format(currentDate, 'MMMM yyyy')}</h2>
          </div>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
            <span className="hidden sm:inline">{format(addMonths(currentDate, 1), 'MMM')}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day header row */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {DAY_HEADERS_SHORT.map((short, i) => (
            <div key={short} className="py-3 text-center">
              <span className="hidden md:inline text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {DAY_HEADERS[i]}
              </span>
              <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {short}
              </span>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <div className="grid grid-cols-7">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="min-h-[130px] border-r border-b last:border-r-0 p-3">
                <Skeleton className="h-5 w-7 mb-3 rounded-full" />
                <Skeleton className="h-6 w-full mb-1.5 rounded" />
                <Skeleton className="h-6 w-3/4 rounded" />
              </div>
            ))}
          </div>
        ) : (
          weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                const dayBookings = getBookingsForDay(day)
                const isToday     = isSameDay(day, today)
                const inMonth     = isSameMonth(day, currentDate)
                const isWeekend   = di >= 5

                return (
                  <div
                    key={di}
                    className={[
                      'min-h-[130px] border-b p-2',
                      di < 6 ? 'border-r' : '',
                      !inMonth ? 'bg-muted/20' : isWeekend ? 'bg-muted/10' : '',
                    ].join(' ')}
                  >
                    {/* Date number */}
                    <div className="flex items-start justify-between mb-2">
                      <div className={[
                        'h-7 w-7 flex items-center justify-center rounded-full text-sm font-semibold transition-colors',
                        isToday
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : inMonth
                            ? isWeekend ? 'text-muted-foreground' : 'text-foreground'
                            : 'text-muted-foreground/30',
                      ].join(' ')}>
                        {format(day, 'd')}
                      </div>
                      {dayBookings.length > 0 && inMonth && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                          {dayBookings.length}
                        </span>
                      )}
                    </div>

                    {/* Booking bars */}
                    <div className="space-y-1 overflow-hidden">
                      {dayBookings.slice(0, 3).map(b => (
                        <Link
                          key={b.id}
                          href="/dashboard/bookings"
                          className={[
                            'flex flex-col px-2 py-1 rounded-md text-xs font-medium leading-tight hover:opacity-80 transition-opacity truncate',
                            STATUS_BAR[b.status] || 'bg-gray-400 text-white',
                          ].join(' ')}
                          title={`${b.guestName}\n${b.property?.name || ''}\n${format(parseISO(b.checkIn), 'MMM d')} → ${format(parseISO(b.checkOut), 'MMM d')}\n${STATUS_LABEL[b.status] || b.status}`}
                        >
                          <span className="truncate font-semibold">{b.guestName}</span>
                          {b.property?.name && (
                            <span className="truncate opacity-80 text-[10px]">{b.property.name}</span>
                          )}
                        </Link>
                      ))}
                      {dayBookings.length > 3 && (
                        <Link
                          href="/dashboard/bookings"
                          className="block text-xs text-primary font-medium px-1 hover:underline"
                        >
                          +{dayBookings.length - 3} more
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4 border-t bg-muted/10">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mr-2">Status</span>
          {LEGEND.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded ${color}`} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
