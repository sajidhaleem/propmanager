'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays,
  LayoutGrid, Clock,
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, parseISO, addMonths, subMonths, addDays,
  startOfDay, endOfDay,
} from 'date-fns'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHero, HERO_CONTROL } from '@/components/layout/PageHero'
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
  PENDING:     { bg: 'bg-yellow-400',   text: 'text-yellow-950', chip: 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/40 dark:text-amber-300',    dot: 'bg-amber-500' },
  CONFIRMED:   { bg: 'bg-blue-500',     text: 'text-white',      chip: 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/40 dark:text-blue-300',           dot: 'bg-blue-500' },
  CHECKED_IN:  { bg: 'bg-green-500',    text: 'text-white',      chip: 'bg-teal-50 border-teal-300 text-teal-800 dark:bg-teal-500/10 dark:border-teal-500/40 dark:text-teal-300',           dot: 'bg-teal-500' },
  CHECKED_OUT: { bg: 'bg-purple-500',   text: 'text-white',      chip: 'bg-purple-50 border-purple-300 text-purple-800 dark:bg-purple-500/10 dark:border-purple-500/40 dark:text-purple-300', dot: 'bg-purple-500' },
  CANCELLED:   { bg: 'bg-red-400/60',   text: 'text-white',      chip: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/40 dark:text-red-300',                 dot: 'bg-red-400' },
  NO_SHOW:     { bg: 'bg-zinc-500/60',  text: 'text-white',      chip: 'bg-zinc-100 border-zinc-300 text-zinc-600 dark:bg-zinc-500/10 dark:border-zinc-500/40 dark:text-zinc-400',          dot: 'bg-zinc-400' },
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

// ── Day-view constants ─────────────────────────────────────────────────────

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6 AM – 11 PM

function formatHour(h: number) {
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${suffix}`
}

// Which timeline slot a booking belongs to on a given day:
// arrival day → check-in hour, departure day → check-out hour,
// mid-stay days → first slot (shown as "in residence").
type DaySlotKind = 'checkin' | 'checkout' | 'stay'

function bookingSlotForDay(b: Booking, day: Date): { hour: number; kind: DaySlotKind } {
  const ci = parseISO(b.checkIn)
  const co = parseISO(b.checkOut)
  const clampHour = (h: number) => Math.min(23, Math.max(6, h))
  if (isSameDay(ci, day)) return { hour: clampHour(ci.getHours()), kind: 'checkin' }
  if (isSameDay(co, day)) return { hour: clampHour(co.getHours()), kind: 'checkout' }
  return { hour: 6, kind: 'stay' }
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

  // Track dates with bookings (entire stay range, not just check-in day)
  const datesWithBookings = new Set(
    bookings.flatMap(b => {
      const ci = parseISO(b.checkIn)
      const co = parseISO(b.checkOut)
      if (isNaN(ci.getTime()) || isNaN(co.getTime()) || co < ci) return []
      return eachDayOfInterval({ start: ci, end: co }).map(d => format(d, 'yyyy-MM-dd'))
    })
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
            aria-label="Previous month"
            className="w-7 h-7 [@media(pointer:coarse)]:w-10 [@media(pointer:coarse)]:h-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewDate(d => addMonths(d, 1))}
            aria-label="Next month"
            className="w-7 h-7 [@media(pointer:coarse)]:w-10 [@media(pointer:coarse)]:h-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                'aspect-square flex items-center justify-center text-sm rounded-full relative transition-[transform,color,background-color] duration-100 font-medium',
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
  onNewBooking,
}: {
  selectedDay: Date
  bookings: Booking[]
  isLoading: boolean
  onNewBooking: (dtLocal: string) => void
}) {
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
    onNewBooking(`${d}T${pad(h)}:00`)
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
            const bksThisHour = dayBookings.filter(b => bookingSlotForDay(b, selectedDay).hour === hour)
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
                    hover:bg-muted/30 cursor-pointer transition-colors group relative
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  role="button"
                  tabIndex={bksThisHour.length === 0 ? 0 : -1}
                  aria-label={`Book ${formatHour(hour)} slot`}
                  onClick={() => bksThisHour.length === 0 && handleNewBooking(hour)}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && bksThisHour.length === 0) { e.preventDefault(); handleNewBooking(hour) } }}
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
                    const kind = bookingSlotForDay(b, selectedDay).kind
                    return (
                      <Link
                        key={b.id}
                        href="/dashboard/bookings"
                        onClick={e => e.stopPropagation()}
                        className={cn(
                          'flex-1 min-w-[160px] rounded-lg px-3 py-2 border-l-[3px] border text-sm',
                          'hover:brightness-95 hover:-translate-y-px transition-[transform,filter] cursor-pointer',
                          c.chip,
                        )}
                      >
                        <div className="font-semibold truncate">{b.guestName}</div>
                        <div className="text-xs opacity-70 mt-0.5">
                          {kind === 'checkin'  && <>In {format(ci, 'h:mm a')} · out {format(co, 'MMM d, h:mm a')}</>}
                          {kind === 'checkout' && <>Checks out {format(co, 'h:mm a')}</>}
                          {kind === 'stay'     && <>In residence · out {format(co, 'MMM d, h:mm a')}</>}
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

// ── Status accent bars (Scheduled rail + month grid) ───────────────────────

const STATUS_BAR: Record<string, string> = {
  PENDING:     'bg-amber-400',
  CONFIRMED:   'bg-cyan-400',
  CHECKED_IN:  'bg-emerald-400',
  CHECKED_OUT: 'bg-violet-400',
  CANCELLED:   'bg-red-400',
  NO_SHOW:     'bg-zinc-400',
}

// ── Month grid (spatial glass day cells) ────────────────────────────────────

function MonthGrid({
  current, days, bookings, selectedDay, today, onSelectDay,
}: {
  current: Date
  days: Date[]
  bookings: Booking[]
  selectedDay: Date
  today: Date
  onSelectDay: (d: Date) => void
}) {
  const mStart = startOfMonth(current)
  const startPad = mStart.getDay()
  const cells: (Date | null)[] = [...Array(startPad).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)

  function dayBookingsList(day: Date) {
    return bookings
      .filter(b => slotType(b, day) !== null)
      .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime())
  }

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
        <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground pb-1">
          {d}
        </div>
      ))}
      <AnimatePresence mode="popLayout">
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${current.getMonth()}-${i}`} />
          const isToday    = isSameDay(day, today)
          const isSelected = isSameDay(day, selectedDay)
          const dayBks     = dayBookingsList(day)
          return (
            <motion.button
              key={day.toISOString()}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.32, delay: Math.min(i * 0.012, 0.28), ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onSelectDay(day)}
              className={cn(
                'group relative aspect-square sm:aspect-[5/4] rounded-xl border p-2 text-left overflow-hidden',
                'transition-[transform,box-shadow,border-color,background-color] duration-200',
                'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected
                  ? 'border-primary/50 bg-primary/10 dark:glow-cyan'
                  : 'border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/70',
              )}
            >
              <span className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold',
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
              )}>
                {format(day, 'd')}
              </span>
              <div className="mt-1.5 space-y-1">
                {dayBks.slice(0, 2).map(b => {
                  const c = STATUS_COLORS[b.status] || STATUS_COLORS.CONFIRMED
                  return (
                    <div key={b.id} className={cn('truncate rounded px-1 py-0.5 text-[10px] font-medium border', c.chip)}>
                      {b.guestName}
                    </div>
                  )
                })}
                {dayBks.length > 2 && (
                  <div className="text-[10px] text-muted-foreground font-semibold pl-1">+{dayBks.length - 2} more</div>
                )}
              </div>
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// ── Scheduled rail (right panel) ────────────────────────────────────────────

function ScheduledRail({
  day, bookings, isLoading, onPrevDay, onNextDay, onOpenDayView, onNewBooking,
}: {
  day: Date
  bookings: Booking[]
  isLoading: boolean
  onPrevDay: () => void
  onNextDay: () => void
  onOpenDayView: () => void
  onNewBooking: () => void
}) {
  const { format: money } = useCurrency()
  const dayBookings = bookingsForDay(bookings, day)
    .sort((a, b) => bookingSlotForDay(a, day).hour - bookingSlotForDay(b, day).hour)

  return (
    <div className="glass-panel depth-1 rounded-2xl p-5 w-full lg:w-[300px] shrink-0 flex flex-col lg:max-h-[calc(100vh-220px)]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Scheduled</h3>
        <div className="flex items-center gap-1">
          <button onClick={onPrevDay} aria-label="Previous day"
            className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={onNextDay} aria-label="Next day"
            className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <button onClick={onOpenDayView} className="text-left group mb-4">
        <p className="text-lg font-display font-semibold group-hover:text-primary transition-colors">
          {format(day, 'd MMMM, yyyy')}
        </p>
        <p className="text-xs text-muted-foreground group-hover:text-primary/80 transition-colors">
          {format(day, 'EEEE')} · Open hourly view →
        </p>
      </button>

      <Button size="sm" className="mb-4 gap-1.5 w-full" onClick={onNewBooking}>
        <Plus className="h-3.5 w-3.5" /> New Booking
      </Button>

      <div className="flex-1 overflow-y-auto scrollbar-thin -mx-1 px-1 space-y-2.5">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-[72px] w-full rounded-xl" />)
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {dayBookings.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground py-6 text-center"
              >
                Nothing scheduled this day.
              </motion.p>
            ) : (
              dayBookings.map((b, i) => {
                const bar = STATUS_BAR[b.status] || STATUS_BAR.CONFIRMED
                const kind = bookingSlotForDay(b, day).kind
                const ci = parseISO(b.checkIn)
                const co = parseISO(b.checkOut)
                return (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href="/dashboard/bookings"
                      className="block rounded-xl border border-border/60 bg-card/60 overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-[transform,border-color] group"
                    >
                      <div className={cn('h-[3px] w-full', bar)} />
                      <div className="p-3">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{b.guestName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.property?.name}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>
                            {kind === 'checkin'  && `In ${format(ci, 'h:mm a')}`}
                            {kind === 'checkout' && `Out ${format(co, 'h:mm a')}`}
                            {kind === 'stay'     && 'In residence'}
                          </span>
                          <span className="font-semibold text-foreground">{money(b.totalAmount)}</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

// ── Quick booking dialog ───────────────────────────────────────────────────

const PLATFORM_OPTIONS = [
  { value: 'DIRECT',      label: 'Direct' },
  { value: 'AIRBNB',      label: 'Airbnb' },
  { value: 'BOOKING_COM', label: 'Booking.com' },
  { value: 'VRBO',        label: 'VRBO' },
  { value: 'OTHER',       label: 'Other' },
]

const QUICK_EMPTY = { guestName: '', propertyId: '', checkIn: '', checkOut: '', rate: '', platform: 'DIRECT', paidAmount: '' }

function QuickBookingDialog({
  open, onOpenChange, initial, properties,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: typeof QUICK_EMPTY
  properties: Property[]
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [form, setForm] = useState(initial)

  // Re-seed the form each time the dialog opens with a new slot
  useEffect(() => { if (open) setForm(initial) }, [open, initial])

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName:  form.guestName,
          propertyId: form.propertyId,
          checkIn:    new Date(form.checkIn).toISOString(),
          checkOut:   new Date(form.checkOut).toISOString(),
          rate:       Number(form.rate) || 0,
          platform:   form.platform,
          paidAmount: Number(form.paidAmount) || 0,
          status:     'CONFIRMED',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create booking')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-day'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      onOpenChange(false)
      toast.success('Booking created')
    },
    onError: (e: Error) => toast.error(e.message, { duration: 5000 }),
  })

  function submit() {
    if (!form.guestName.trim()) { toast.error('Guest name is required'); return }
    if (!form.propertyId)       { toast.error('Pick a room'); return }
    if (!form.checkIn || !form.checkOut) { toast.error('Set check-in and check-out'); return }
    createMutation.mutate()
  }

  const selectedProperty = properties.find(p => p.id === form.propertyId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qb-guest">Guest Name *</Label>
            <Input id="qb-guest" autoFocus value={form.guestName}
              onChange={e => setForm({ ...form, guestName: e.target.value })}
              placeholder="e.g. Ahmed Khan" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Room *</Label>
              <Select value={form.propertyId}
                onValueChange={v => {
                  const prop = properties.find(p => p.id === v)
                  setForm(f => ({ ...f, propertyId: v, rate: f.rate || String(prop?.baseRate ?? '') }))
                }}>
                <SelectTrigger><SelectValue placeholder="Pick a room" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qb-ci">Check-in *</Label>
              <Input id="qb-ci" type="datetime-local" value={form.checkIn}
                onChange={e => setForm({ ...form, checkIn: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qb-co">Check-out *</Label>
              <Input id="qb-co" type="datetime-local" value={form.checkOut}
                onChange={e => setForm({ ...form, checkOut: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qb-rate">Rate / Night (Rs)</Label>
              <Input id="qb-rate" type="number" min="0" value={form.rate}
                onChange={e => setForm({ ...form, rate: e.target.value })}
                placeholder={selectedProperty ? String(selectedProperty.baseRate) : '0'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qb-paid">Paid (Rs)</Label>
              <Input id="qb-paid" type="number" min="0" value={form.paidAmount}
                onChange={e => setForm({ ...form, paidAmount: e.target.value })} placeholder="0" />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" className="text-muted-foreground"
            onClick={() => router.push(`/dashboard/bookings?checkIn=${form.checkIn || format(new Date(), "yyyy-MM-dd'T'10:00")}`)}>
            Full form (CNIC, misc…)
          </Button>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Create Booking'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'day'>('month')
  const [current, setCurrent] = useState(new Date())  // month-view month
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickInitial, setQuickInitial] = useState(QUICK_EMPTY)

  // Open the quick-booking dialog prefilled from a date/time
  const openQuickBooking = useCallback((dtLocal?: string) => {
    const ci = dtLocal ?? format(new Date(), "yyyy-MM-dd'T'14:00")
    const ciDate = new Date(ci)
    const coDate = new Date(ciDate); coDate.setDate(coDate.getDate() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    const co = `${coDate.getFullYear()}-${pad(coDate.getMonth() + 1)}-${pad(coDate.getDate())}T12:00`
    setQuickInitial({ ...QUICK_EMPTY, checkIn: ci, checkOut: co })
    setQuickOpen(true)
  }, [])

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

  // Day-view: fetch a window bracketing the selected day's month
  // (covers in-progress stays that started earlier + upcoming list)
  const dayWindowStart = format(addDays(startOfMonth(selectedDay), -31), 'yyyy-MM-dd')
  const dayWindowEnd   = format(addDays(endOfMonth(selectedDay), 60), 'yyyy-MM-dd')
  const { data: dayData, isLoading: dayLoading } = useQuery({
    queryKey: ['calendar-day', format(selectedDay, 'yyyy-MM')],
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHero
        title="Calendar"
        description={
          view === 'month'
            ? `${bookings.length} booking${bookings.length !== 1 ? 's' : ''} · ${format(current, 'MMMM yyyy')}`
            : format(selectedDay, 'EEEE, MMMM d, yyyy')
        }
      >
        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.08] p-1 backdrop-blur-sm">
          {([
            { key: 'month', label: 'Month', Icon: LayoutGrid },
            { key: 'day',   label: 'Day',   Icon: Clock },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                view === key ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={() => openQuickBooking(format(view === 'day' ? selectedDay : new Date(), "yyyy-MM-dd'T'14:00"))}>
          <Plus className="h-4 w-4" />New Booking
        </Button>
      </PageHero>

      <QuickBookingDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        initial={quickInitial}
        properties={properties}
      />

      {/* ── DAY VIEW ── */}
      {view === 'day' && (
        <Card className="overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-220px)] lg:min-h-[600px]">
            {/* Left panel */}
            <div className="w-full lg:w-[300px] flex-shrink-0 border-b lg:border-b-0 lg:border-r flex flex-col p-5 overflow-y-auto max-h-[360px] lg:max-h-none">
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
            <div className="flex-1 min-w-0 h-[60vh] lg:h-auto">
              <DayTimeline
                selectedDay={selectedDay}
                bookings={dayBookings}
                isLoading={dayLoading}
                onNewBooking={openQuickBooking}
              />
            </div>
          </div>
        </Card>
      )}

      {/* ── MONTH VIEW (spatial glass grid + scheduled rail) ── */}
      {view === 'month' && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="glass-panel depth-1 rounded-2xl p-5 flex-1 min-w-0 w-full">
            {/* Month navigation */}
            <div className="flex items-center justify-between pb-4 mb-1">
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => setCurrent(d => subMonths(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{format(subMonths(current, 1), 'MMM')}</span>
              </Button>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-display font-bold tracking-tight">{format(current, 'MMMM yyyy')}</h2>
                {!isCurrentMonth && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary"
                    onClick={() => { setCurrent(new Date()); setSelectedDay(new Date()) }}>
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

            {isLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {[...Array(35)].map((_, i) => <Skeleton key={i} className="aspect-square sm:aspect-[5/4] rounded-xl" />)}
              </div>
            ) : properties.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No properties found.{' '}
                <Link href="/dashboard/properties" className="text-primary hover:underline">Add a property</Link>
              </div>
            ) : (
              <MonthGrid
                current={current}
                days={days}
                bookings={bookings}
                selectedDay={selectedDay}
                today={today}
                onSelectDay={handleSelectDay}
              />
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 mt-4 border-t border-border/60">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</span>
              {[
                { label: 'Pending',     color: STATUS_BAR.PENDING },
                { label: 'Confirmed',   color: STATUS_BAR.CONFIRMED },
                { label: 'Checked in',  color: STATUS_BAR.CHECKED_IN },
                { label: 'Checked out', color: STATUS_BAR.CHECKED_OUT },
                { label: 'Cancelled',   color: STATUS_BAR.CANCELLED },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={cn('h-2.5 w-2.5 rounded-full', color)} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right rail — live agenda for the selected day */}
          <ScheduledRail
            day={selectedDay}
            bookings={bookings}
            isLoading={isLoading}
            onPrevDay={() => handleSelectDay(addDays(selectedDay, -1))}
            onNextDay={() => handleSelectDay(addDays(selectedDay, 1))}
            onOpenDayView={() => setView('day')}
            onNewBooking={() => openQuickBooking(format(selectedDay, "yyyy-MM-dd'T'14:00"))}
          />
        </div>
      )}
    </div>
  )
}
