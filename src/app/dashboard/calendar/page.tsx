'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, Bell,
  LayoutGrid, Clock,
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, parseISO, addMonths, subMonths, addDays,
  startOfDay, endOfDay,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking, Property } from '@/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

// ── Data fetchers ──────────────────────────────────────────────────────────

async function fetchCalendarBookings(startDate: string, endDate: string) {
  const res = await fetch(`/api/bookings?startDate=${startDate}&endDate=${endDate}&limit=300&sortBy=checkIn&sortOrder=asc`)
  if (!res.ok) throw new Error('Failed')
  return res.json()
}
async function fetchProperties() {
  const res = await fetch('/api/properties')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

// ── Status colours ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; chip: string; dot: string }> = {
  PENDING:     { bg: 'bg-yellow-400',   text: 'text-yellow-950', chip: 'bg-amber-50 border-amber-300 text-amber-800',   dot: 'bg-amber-500' },
  CONFIRMED:   { bg: 'bg-blue-500',     text: 'text-white',      chip: 'bg-blue-50 border-blue-300 text-blue-800',       dot: 'bg-blue-500' },
  CHECKED_IN:  { bg: 'bg-green-500',    text: 'text-white',      chip: 'bg-teal-50 border-teal-300 text-teal-800',       dot: 'bg-teal-500' },
  CHECKED_OUT: { bg: 'bg-purple-500',   text: 'text-white',      chip: 'bg-purple-50 border-purple-300 text-purple-800', dot: 'bg-purple-500' },
  CANCELLED:   { bg: 'bg-red-400/60',   text: 'text-white',      chip: 'bg-red-50 border-red-200 text-red-700',          dot: 'bg-red-400' },
  NO_SHOW:     { bg: 'bg-zinc-500/60',  text: 'text-white',      chip: 'bg-zinc-100 border-zinc-300 text-zinc-600',      dot: 'bg-zinc-400' },
}

// ── Month-grid helpers ──────────────────────────────────────────────────────

type Slot = 'single' | 'checkin' | 'middle' | 'checkout'

function slotType(b: Booking, day: Date): Slot | null {
  const ci  = parseISO(b.checkIn)
  const co  = parseISO(b.checkOut)
  const ciD = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate())
  const coD = new Date(co.getFullYear(), co.getMonth(), co.getDate())
  const d   = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  if (d < ciD || d > coD) return null
  const atCI = d.getTime() === ciD.getTime()
  const atCO = d.getTime() === coD.getTime()
  if (atCI && atCO) return 'single'
  if (atCI) return 'checkin'
  if (atCO) return 'checkout'
  return 'middle'
}

const ROOM_W = 130
const DAY_W  = 132
const ROW_H  = 72

// ── Day-view constants ─────────────────────────────────────────────────────

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6 AM – 11 PM

function formatHour(h: number) {
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${suffix}`
}

function bookingOverlapsHour(b: Booking, hour: number): boolean {
  const ci = parseISO(b.checkIn)
  const co = parseISO(b.checkOut)
  return ci.getHours() === hour
}

function bookingsForDay(bookings: Booking[], day: Date): Booking[] {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  return bookings.filter(b => {
    const ci = parseISO(b.checkIn)
    const co = parseISO(b.checkOut)
    const ciD = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate())
    const coD = new Date(co.getFullYear(), co.getMonth(), co.getDate())
    return d >= ciD && d <= coD
  })
}

// ── Mini-calendar component ────────────────────────────────────────────────

function MiniCalendar({
  selectedDay,
  onSelectDay,
  bookings,
}: {
  selectedDay: Date
  onSelectDay: (d: Date) => void
  bookings: Booking[]
}) {
  const [viewDate, setViewDate] = useState(new Date(selectedDay))
  const today = new Date()
  const mStart = startOfMonth(viewDate)
  const days = eachDayOfInterval({ start: mStart, end: endOfMonth(viewDate) })

  // Pad to full weeks
  const startPad = mStart.getDay()
  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...days,
  ]

  // Track dates with bookings
  const datesWithBookings = new Set(
    bookings.map(b => format(parseISO(b.checkIn), 'yyyy-MM-dd'))
  )

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-foreground">
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewDate(d => subMonths(d, 1))}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewDate(d => addMonths(d, 1))}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, selectedDay)
          const hasBooking = datesWithBookings.has(format(day, 'yyyy-MM-dd'))

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                onSelectDay(day)
                setViewDate(day)
              }}
              className={cn(
                'aspect-square flex items-center justify-center text-sm rounded-full relative transition-all duration-100 font-medium',
                isToday
                  ? 'bg-primary text-primary-foreground font-bold'
                  : isSelected
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-foreground hover:bg-muted hover:scale-105',
              )}
            >
              {format(day, 'd')}
              {hasBooking && !isToday && (
                <span className={cn(
                  'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                  isSelected ? 'bg-primary' : 'bg-primary/60'
                )} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Upcoming list ──────────────────────────────────────────────────────────

function UpcomingList({ bookings, onSelectDay }: { bookings: Booking[], onSelectDay: (d: Date) => void }) {
  const today = startOfDay(new Date())
  const upcoming = bookings
    .filter(b => parseISO(b.checkIn) >= today)
    .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime())
    .slice(0, 6)

  if (upcoming.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No upcoming bookings.</p>
  }

  return (
    <div className="space-y-0.5">
      {upcoming.map(b => {
        const ci = parseISO(b.checkIn)
        const c = STATUS_COLORS[b.status] || STATUS_COLORS.CONFIRMED
        return (
          <button
            key={b.id}
            onClick={() => onSelectDay(ci)}
            className="w-full flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-left"
          >
            <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', c.dot)} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{b.guestName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(ci, 'EEE, MMM d')} · {format(ci, 'h:mm a')}
                {b.property && <span className="text-muted-foreground/70"> · {b.property.name}</span>}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Day timeline ───────────────────────────────────────────────────────────

function DayTimeline({
  selectedDay,
  bookings,
  isLoading,
}: {
  selectedDay: Date
  bookings: Booking[]
  isLoading: boolean
}) {
  const router = useRouter()
  const today = new Date()
  const [nowMinute, setNowMinute] = useState<number | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const dayBookings = bookingsForDay(bookings, selectedDay)

  // Current time indicator
  useEffect(() => {
    if (!isSameDay(selectedDay, today)) { setNowMinute(null); return }
    const update = () => {
      const n = new Date()
      setNowMinute((n.getHours() - 6) * 60 + n.getMinutes()) // offset from 6am
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [selectedDay])

  // Scroll to current time or 8am
  useEffect(() => {
    if (!timelineRef.current) return
    const rowH = 76
    const scrollTo = isSameDay(selectedDay, today)
      ? Math.max(0, (today.getHours() - 7) * rowH)
      : 2 * rowH // 8am
    timelineRef.current.scrollTop = scrollTo
  }, [selectedDay])

  const isToday = isSameDay(selectedDay, today)

  function handleNewBooking(hour?: number) {
    const d = format(selectedDay, 'yyyy-MM-dd')
    const h = hour ?? 10
    const pad = (n: number) => String(n).padStart(2, '0')
    router.push(`/dashboard/bookings?checkIn=${d}T${pad(h)}:00`)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Day header */}
      <div className="flex items-center justify-between px-6 h-14 flex-shrink-0 bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-base font-bold">{format(selectedDay, 'EEEE, MMMM d')}</span>
            {isToday && (
              <span className="ml-2 text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">Today</span>
            )}
          </div>
          {dayBookings.length > 0 && (
            <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              {dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white gap-1.5"
          onClick={() => handleNewBooking()}
        >
          <Plus className="h-3.5 w-3.5" />
          New Booking
        </Button>
      </div>

      {/* Timeline */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto scrollbar-thin py-3">
        {isLoading ? (
          <div className="space-y-2 px-6 pt-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          HOURS.map((hour) => {
            const bksThisHour = dayBookings.filter(b => bookingOverlapsHour(b, hour))
            const rowH = 76
            // Current time line
            const showNowLine = nowMinute !== null && Math.floor(nowMinute / 60) + 6 === hour
            const nowLineTop = nowMinute !== null ? ((nowMinute % 60) / 60) * rowH : 0

            return (
              <div
                key={hour}
                className="flex items-start relative"
                style={{ minHeight: rowH }}
              >
                {/* Time label */}
                <div className="w-[72px] flex-shrink-0 text-right pr-3 text-xs text-muted-foreground -translate-y-2 font-tabular-nums pt-0.5">
                  {formatHour(hour)}
                </div>

                {/* Content area */}
                <div
                  className="flex-1 border-t border-border/60 min-h-[76px] px-4 py-1.5 flex flex-wrap gap-2 content-start
                    hover:bg-muted/30 cursor-pointer transition-colors group relative"
                  onClick={() => bksThisHour.length === 0 && handleNewBooking(hour)}
                >
                  {/* Now line */}
                  {showNowLine && (
                    <>
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-red-500 pointer-events-none z-10"
                        style={{ top: nowLineTop }}
                      />
                      <div
                        className="absolute left-[-5px] w-2.5 h-2.5 rounded-full bg-red-500 pointer-events-none z-10"
                        style={{ top: nowLineTop - 5 }}
                      />
                    </>
                  )}

                  {/* Booking chips */}
                  {bksThisHour.map(b => {
                    const ci = parseISO(b.checkIn)
                    const co = parseISO(b.checkOut)
                    const c = STATUS_COLORS[b.status] || STATUS_COLORS.CONFIRMED
                    return (
                      <Link
                        key={b.id}
                        href="/dashboard/bookings"
                        onClick={e => e.stopPropagation()}
                        className={cn(
                          'flex-1 min-w-[160px] rounded-lg px-3 py-2 border-l-[3px] border text-sm',
                          'hover:brightness-95 hover:-translate-y-px transition-all cursor-pointer',
                          c.chip,
                        )}
                      >
                        <div className="font-semibold truncate">{b.guestName}</div>
                        <div className="text-xs opacity-70 mt-0.5">
                          {format(ci, 'h:mm a')} – {format(co, 'h:mm a')}
                          {b.property && <> · {b.property.name}</>}
                        </div>
                      </Link>
                    )
                  })}

                  {/* Empty slot hint */}
                  {bksThisHour.length === 0 && (
                    <span className="text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-2">
                      + Book this slot
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'day'>('month')
  const [current, setCurrent] = useState(new Date())  // month-view month
  const [selectedDay, setSelectedDay] = useState(new Date())
  const { format: money } = useCurrency()
  const scrollRef = useRef<HTMLDivElement>(null)

  const mStart = startOfMonth(current)
  const mEnd   = endOfMonth(current)
  const days   = eachDayOfInterval({ start: mStart, end: mEnd })
  const today  = new Date()
  const isCurrentMonth = isSameDay(startOfMonth(today), mStart)

  // Month-view: fetch bookings for the visible month
  const { data: bData, isLoading: bLoading } = useQuery({
    queryKey: ['calendar', format(mStart, 'yyyy-MM')],
    queryFn:  () => fetchCalendarBookings(format(mStart, 'yyyy-MM-dd'), format(mEnd, 'yyyy-MM-dd')),
  })

  // Day-view: fetch bookings for a wider window (today + 30 days for upcoming + selected day)
  const dayWindowStart = format(startOfDay(today), 'yyyy-MM-dd')
  const dayWindowEnd   = format(endOfDay(addDays(today, 60)), 'yyyy-MM-dd')
  const { data: dayData, isLoading: dayLoading } = useQuery({
    queryKey: ['calendar-day', dayWindowStart],
    queryFn:  () => fetchCalendarBookings(dayWindowStart, dayWindowEnd),
    enabled:  view === 'day',
  })

  const { data: pData, isLoading: pLoading } = useQuery({
    queryKey: ['properties'],
    queryFn:  fetchProperties,
  })

  const isLoading = bLoading || pLoading

  const bookings: Booking[]  = bData?.data?.data || []
  const dayBookings: Booking[] = dayData?.data?.data || []
  const properties: Property[] = [...(pData?.data || [])]
    .filter((p: Property) => p.status !== 'INACTIVE')
    .sort((a: Property, b: Property) => a.name.localeCompare(b.name))

  // Sync month view to follow selected day
  const handleSelectDay = useCallback((d: Date) => {
    setSelectedDay(d)
    setCurrent(d)
  }, [])

  // Scroll month grid to today
  useEffect(() => {
    const el = scrollRef.current
    if (!el || isLoading || view !== 'month') return
    const frame = requestAnimationFrame(() => {
      if (isCurrentMonth) {
        const todayIndex = days.findIndex(d => isSameDay(d, today))
        el.scrollLeft = todayIndex > 0 ? Math.max(0, (todayIndex - 1) * DAY_W) : 0
      } else {
        el.scrollLeft = 0
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [current, isCurrentMonth, isLoading, view])

  function cellBookings(propId: string, day: Date): Booking[] {
    return bookings
      .filter(b => b.propertyId === propId && slotType(b, day) !== null)
      .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime())
  }

  function dayCount(day: Date) {
    return bookings.filter(b => slotType(b, day) !== null).length
  }

  const totalW = ROOM_W + days.length * DAY_W

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description={
          view === 'month'
            ? `${bookings.length} booking${bookings.length !== 1 ? 's' : ''} · ${format(current, 'MMMM yyyy')}`
            : format(selectedDay, 'EEEE, MMMM d, yyyy')
        }
      >
        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/40">
          <button
            onClick={() => setView('month')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              view === 'month'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Month
          </button>
          <button
            onClick={() => setView('day')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              view === 'day'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Day
          </button>
        </div>

        <Button size="sm" asChild>
          <Link href="/dashboard/bookings"><Plus className="h-4 w-4" />New Booking</Link>
        </Button>
      </PageHeader>

      {/* ── DAY VIEW ── */}
      {view === 'day' && (
        <Card className="overflow-hidden">
          <div className="flex h-[calc(100vh-220px)] min-h-[600px]">
            {/* Left panel */}
            <div className="w-[300px] flex-shrink-0 border-r flex flex-col p-5 overflow-y-auto">
              {/* Mini calendar */}
              <MiniCalendar
                selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
                bookings={dayBookings}
              />

              {/* Upcoming */}
              <div className="mt-5 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Upcoming
                </p>
                {dayLoading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                  </div>
                ) : (
                  <UpcomingList bookings={dayBookings} onSelectDay={handleSelectDay} />
                )}
              </div>
            </div>

            {/* Right panel: day timeline */}
            <div className="flex-1 min-w-0">
              <DayTimeline
                selectedDay={selectedDay}
                bookings={dayBookings}
                isLoading={dayLoading}
              />
            </div>
          </div>
        </Card>
      )}

      {/* ── MONTH VIEW (Gantt grid) ── */}
      {view === 'month' && (
        <Card className="overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => setCurrent(d => subMonths(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{format(subMonths(current, 1), 'MMM')}</span>
            </Button>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-bold tracking-tight">{format(current, 'MMMM yyyy')}</h2>
              {!isCurrentMonth && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary"
                  onClick={() => setCurrent(new Date())}>
                  Today
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => setCurrent(d => addMonths(d, 1))}>
              <span className="hidden sm:inline">{format(addMonths(current, 1), 'MMM')}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable Gantt grid */}
          <div ref={scrollRef} className="overflow-x-auto">
            <table className="border-collapse table-fixed" style={{ width: totalW, minWidth: totalW }}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th
                    className="sticky left-0 z-20 border-r bg-muted text-left px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground shadow-[4px_0_6px_-4px_rgb(0_0_0_/_0.12)]"
                    style={{ width: ROOM_W, minWidth: ROOM_W }}
                  >
                    Room
                  </th>
                  {days.map(day => {
                    const isToday   = isSameDay(day, today)
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6
                    const count     = dayCount(day)
                    return (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          'border-r px-1 py-2 text-center cursor-pointer hover:bg-primary/5 transition-colors',
                          isToday   ? 'bg-primary/15' :
                          isWeekend ? 'bg-muted/30'   : '',
                        )}
                        style={{ width: DAY_W, minWidth: DAY_W }}
                        onClick={() => { handleSelectDay(day); setView('day') }}
                        title={`Switch to day view: ${format(day, 'MMMM d')}`}
                      >
                        <div className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide',
                          isToday ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          {format(day, 'EEE')}
                        </div>
                        <div className={cn(
                          'text-lg font-bold leading-none mt-0.5',
                          isToday ? 'text-primary' : ''
                        )}>
                          {format(day, 'd')}
                        </div>
                        {count > 0 && (
                          <span className={cn(
                            'mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                            isToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            {count}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="sticky left-0 z-10 bg-card border-r px-3 py-3 shadow-[4px_0_6px_-4px_rgb(0_0_0_/_0.12)]">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      {days.map((_, j) => (
                        <td key={j} className="border-r px-1 py-1">
                          <Skeleton className="h-14 w-full rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : properties.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      No properties found.{' '}
                      <Link href="/dashboard/properties" className="text-primary hover:underline">Add a property</Link>
                    </td>
                  </tr>
                ) : (
                  properties.map((prop, ri) => (
                    <tr
                      key={prop.id}
                      className={cn('border-b', ri % 2 === 1 ? 'bg-muted/5' : '')}
                      style={{ height: ROW_H }}
                    >
                      <td
                        className="sticky left-0 z-10 border-r px-3 py-2 align-middle bg-card shadow-[4px_0_6px_-4px_rgb(0_0_0_/_0.12)]"
                        style={{ width: ROOM_W, minWidth: ROOM_W }}
                      >
                        <div className="font-semibold text-sm leading-tight">{prop.name}</div>
                        <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{prop.type}</div>
                      </td>

                      {days.map(day => {
                        const bks       = cellBookings(prop.id, day)
                        const isToday   = isSameDay(day, today)
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6
                        return (
                          <td
                            key={day.toISOString()}
                            className={cn(
                              'border-r px-0.5 py-0.5 align-top',
                              isToday   ? 'bg-primary/5'  :
                              isWeekend ? 'bg-muted/10'   : '',
                            )}
                            style={{ width: DAY_W, minWidth: DAY_W }}
                          >
                            <div className="flex flex-col gap-0.5">
                              {bks.map(b => {
                                const slot = slotType(b, day)!
                                const c    = STATUS_COLORS[b.status] || STATUS_COLORS.CONFIRMED
                                const ci   = parseISO(b.checkIn)
                                const co   = parseISO(b.checkOut)
                                const radius =
                                  slot === 'single'   ? 'rounded mx-0.5' :
                                  slot === 'checkin'  ? 'rounded-l ml-0.5' :
                                  slot === 'checkout' ? 'rounded-r mr-0.5' :
                                                        ''
                                const reminderDay = (b as any).reminderAt
                                  ? isSameDay(parseISO((b as any).reminderAt), day)
                                  : false
                                return (
                                  <Link
                                    key={b.id}
                                    href="/dashboard/bookings"
                                    title={`${b.guestName} · ${prop.name}\n${format(ci, 'MMM d, h:mm a')} → ${format(co, 'MMM d, h:mm a')}\nTotal: ${money(b.totalAmount)} · Paid: ${money(b.paidAmount ?? 0)}`}
                                    className={cn(
                                      'block overflow-hidden px-1.5 py-1 text-[10px] leading-tight hover:brightness-110 transition-all cursor-pointer',
                                      c.bg, c.text, radius,
                                    )}
                                  >
                                    {(slot === 'checkin' || slot === 'single') && (
                                      <>
                                        <div className="font-bold truncate flex items-center gap-0.5">
                                          {reminderDay && <Bell className="h-2.5 w-2.5 shrink-0 opacity-90" />}
                                          <span className="truncate">{b.guestName}</span>
                                        </div>
                                        <div className="opacity-90 mt-0.5">
                                          {format(ci, 'h:mm a')} – {format(co, 'h:mm a')}
                                        </div>
                                        <div className="font-semibold opacity-90">{money(b.totalAmount)}</div>
                                      </>
                                    )}
                                    {slot === 'middle' && (
                                      <div className="font-semibold truncate opacity-80 py-0.5 flex items-center gap-0.5">
                                        {reminderDay && <Bell className="h-2.5 w-2.5 shrink-0" />}
                                        <span className="truncate">{b.guestName}</span>
                                      </div>
                                    )}
                                    {slot === 'checkout' && (
                                      <>
                                        <div className="font-semibold truncate opacity-80 flex items-center gap-0.5">
                                          {reminderDay && <Bell className="h-2.5 w-2.5 shrink-0" />}
                                          <span className="truncate">{b.guestName}</span>
                                        </div>
                                        <div className="opacity-70">out {format(co, 'h:mm a')}</div>
                                      </>
                                    )}
                                  </Link>
                                )
                              })}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 border-t bg-muted/10">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</span>
            {[
              { label: 'Pending',     color: 'bg-yellow-400' },
              { label: 'Confirmed',   color: 'bg-blue-500' },
              { label: 'Checked in',  color: 'bg-green-500' },
              { label: 'Checked out', color: 'bg-purple-500' },
              { label: 'Cancelled',   color: 'bg-red-400/60' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={cn('h-3 w-3 rounded-sm', color)} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-4">
              <Bell className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Reminder set</span>
            </div>
            <span className="ml-auto text-xs text-muted-foreground">Click a date header to switch to day view →</span>
          </div>
        </Card>
      )}
    </div>
  )
}
