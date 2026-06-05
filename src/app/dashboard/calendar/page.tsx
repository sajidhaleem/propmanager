'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isToday, addMonths, subMonths, isSameDay, isWithinInterval,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking } from '@/types'

const ROOM_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
]
const ROOM_LIGHT_COLORS = [
  'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800',
]

async function fetchBookings(start: string, end: string) {
  const res = await fetch(`/api/bookings?startDate=${start}&endDate=${end}&limit=200`)
  if (!res.ok) throw new Error('Failed to fetch')
  const data = await res.json()
  return data.data?.data || []
}

async function fetchProperties() {
  const res = await fetch('/api/properties')
  const data = await res.json()
  return data.data || []
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const { format: formatMoney } = useCurrency()

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', 'calendar', format(monthStart, 'yyyy-MM')],
    queryFn: () => fetchBookings(
      format(calStart, 'yyyy-MM-dd'),
      format(calEnd, 'yyyy-MM-dd')
    ),
  })

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: fetchProperties,
  })

  const propertyColorMap = Object.fromEntries(
    properties.map((p: any, i: number) => [p.id, i % ROOM_COLORS.length])
  )

  function getBookingsForDay(day: Date): Booking[] {
    return bookings.filter((b: Booking) => {
      const checkIn = new Date(b.checkIn)
      const checkOut = new Date(b.checkOut)
      return isWithinInterval(day, { start: checkIn, end: checkOut }) ||
        isSameDay(day, checkIn) || isSameDay(day, checkOut)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Booking Calendar" description="Visual overview of all property bookings" />

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {properties.map((p: any, i: number) => (
          <div key={p.id} className="flex items-center gap-2">
            <div className={cn('h-3 w-3 rounded-full', ROOM_COLORS[i % ROOM_COLORS.length])} />
            <span className="text-sm text-muted-foreground">{p.name}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border">
            {days.map((day) => {
              const dayBookings = getBookingsForDay(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[100px] p-1.5 bg-background',
                    !isCurrentMonth && 'bg-muted/30',
                    isToday(day) && 'ring-1 ring-inset ring-primary'
                  )}
                >
                  <p className={cn(
                    'text-xs font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full',
                    isToday(day) && 'bg-primary text-primary-foreground',
                    !isCurrentMonth && 'text-muted-foreground'
                  )}>
                    {format(day, 'd')}
                  </p>
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 3).map((b) => {
                      const colorIdx = propertyColorMap[b.propertyId] ?? 0
                      return (
                        <button
                          key={b.id}
                          className={cn(
                            'w-full text-left text-xs px-1.5 py-0.5 rounded truncate',
                            ROOM_LIGHT_COLORS[colorIdx]
                          )}
                          onClick={() => setSelectedBooking(selectedBooking?.id === b.id ? null : b)}
                        >
                          {b.guestName.split(' ')[0]}
                        </button>
                      )
                    })}
                    {dayBookings.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-1">+{dayBookings.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected booking detail */}
      {selectedBooking && (
        <Card className="border-primary shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                <div>
                  <h3 className="font-semibold text-base">{selectedBooking.guestName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedBooking.property?.name}</p>
                </div>

                {/* Check-in with time */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mt-0.5">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium">Check-in</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{format(new Date(selectedBooking.checkIn), 'EEE, MMM dd, yyyy')}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(selectedBooking.checkIn), 'hh:mm a')}
                    </p>
                  </div>
                </div>

                {/* Check-out with time */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400 mt-0.5">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium">Check-out</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{format(new Date(selectedBooking.checkOut), 'EEE, MMM dd, yyyy')}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(selectedBooking.checkOut), 'hh:mm a')}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  Duration: <span className="font-medium text-foreground">{selectedBooking.nights} night{selectedBooking.nights !== 1 ? 's' : ''}</span>
                </p>
              </div>

              <div className="text-right space-y-2">
                <p className="text-2xl font-bold tabular-nums">{formatMoney(selectedBooking.netAmount)}</p>
                <Badge variant="outline">{selectedBooking.platform}</Badge>
                <div>
                  {selectedBooking.notes && (
                    <p className="text-xs text-muted-foreground mt-1 max-w-[180px] text-right">{selectedBooking.notes}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
