'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
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
  PENDING:     'bg-yellow-400/90 text-yellow-950',
  CONFIRMED:   'bg-blue-500/90 text-white',
  CHECKED_IN:  'bg-green-500/90 text-white',
  CHECKED_OUT: 'bg-purple-500/90 text-white',
  CANCELLED:   'bg-red-400/70 text-white opacity-60',
  NO_SHOW:     'bg-gray-400/70 text-white opacity-60',
}

const LEGEND = [
  { label: 'Pending',      color: 'bg-yellow-400' },
  { label: 'Confirmed',    color: 'bg-blue-500' },
  { label: 'Checked in',   color: 'bg-green-500' },
  { label: 'Checked out',  color: 'bg-purple-500' },
  { label: 'Cancelled',    color: 'bg-red-400' },
]

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

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Monthly booking overview">
        <Button size="sm" asChild>
          <Link href="/dashboard/bookings"><Plus className="h-4 w-4" />New Booking</Link>
        </Button>
      </PageHeader>

      <Card className="overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <div className="grid grid-cols-7">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="min-h-[96px] border-r border-b last:border-r-0 p-2">
                <Skeleton className="h-4 w-5 mb-2" />
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

                return (
                  <div
                    key={di}
                    className={[
                      'min-h-[96px] border-b p-1.5',
                      di < 6 ? 'border-r' : '',
                      !inMonth ? 'bg-muted/20' : '',
                    ].join(' ')}
                  >
                    <div className={[
                      'text-xs font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full',
                      isToday ? 'bg-primary text-primary-foreground' :
                      inMonth  ? 'text-foreground' : 'text-muted-foreground/50',
                    ].join(' ')}>
                      {format(day, 'd')}
                    </div>

                    <div className="space-y-0.5 overflow-hidden">
                      {dayBookings.slice(0, 3).map(b => (
                        <Link
                          key={b.id}
                          href="/dashboard/bookings"
                          className={[
                            'block text-[10px] px-1.5 py-0.5 rounded truncate leading-tight hover:opacity-80 transition-opacity',
                            STATUS_BAR[b.status] || 'bg-gray-400 text-white',
                          ].join(' ')}
                          title={`${b.guestName} — ${b.property?.name || ''}\n${format(parseISO(b.checkIn), 'MMM d')} → ${format(parseISO(b.checkOut), 'MMM d')}`}
                        >
                          {b.guestName}
                        </Link>
                      ))}
                      {dayBookings.length > 3 && (
                        <p className="text-[10px] text-muted-foreground px-1">
                          +{dayBookings.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-t bg-muted/10">
          {LEGEND.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
