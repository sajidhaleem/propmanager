'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, parseISO, addMonths, subMonths,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking, Property } from '@/types'
import Link from 'next/link'

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

// Status → colour tokens
const S: Record<string, { bg: string; text: string }> = {
  PENDING:     { bg: 'bg-yellow-400',       text: 'text-yellow-950' },
  CONFIRMED:   { bg: 'bg-blue-500',         text: 'text-white' },
  CHECKED_IN:  { bg: 'bg-green-500',        text: 'text-white' },
  CHECKED_OUT: { bg: 'bg-purple-500',       text: 'text-white' },
  CANCELLED:   { bg: 'bg-red-400/60',       text: 'text-white' },
  NO_SHOW:     { bg: 'bg-zinc-500/60',      text: 'text-white' },
}

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

const ROOM_W = 130   // sticky property column width (px)
const DAY_W  = 132   // each day column width (px)
const ROW_H  = 72    // min row height (px)

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date())
  const { format: money } = useCurrency()

  const mStart = startOfMonth(current)
  const mEnd   = endOfMonth(current)
  const days   = eachDayOfInterval({ start: mStart, end: mEnd })
  const today  = new Date()

  const { data: bData, isLoading: bLoading } = useQuery({
    queryKey: ['calendar', format(mStart, 'yyyy-MM')],
    queryFn:  () => fetchCalendarBookings(format(mStart, 'yyyy-MM-dd'), format(mEnd, 'yyyy-MM-dd')),
  })
  const { data: pData, isLoading: pLoading } = useQuery({
    queryKey: ['properties'],
    queryFn:  fetchProperties,
  })

  const bookings: Booking[]  = bData?.data?.data || []
  const properties: Property[] = [...(pData?.data || [])]
    .filter((p: Property) => p.status !== 'INACTIVE')
    .sort((a: Property, b: Property) => a.name.localeCompare(b.name))

  const isLoading = bLoading || pLoading

  // Bookings that overlap a given day for a specific property, sorted earliest check-in first
  function cellBookings(propId: string, day: Date): Booking[] {
    return bookings
      .filter(b => {
        if (b.propertyId !== propId) return false
        return slotType(b, day) !== null
      })
      .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime())
  }

  // Total active bookings across all rooms for a day
  function dayCount(day: Date) {
    return bookings.filter(b => slotType(b, day) !== null).length
  }

  const totalW = ROOM_W + days.length * DAY_W

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description={`${bookings.length} booking${bookings.length !== 1 ? 's' : ''} · ${format(current, 'MMMM yyyy')}`}
      >
        <Button size="sm" asChild>
          <Link href="/dashboard/bookings"><Plus className="h-4 w-4" />New Booking</Link>
        </Button>
      </PageHeader>

      <Card className="overflow-hidden">
        {/* ── Month navigation ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => setCurrent(d => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{format(subMonths(current, 1), 'MMM')}</span>
          </Button>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">{format(current, 'MMMM yyyy')}</h2>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => setCurrent(d => addMonths(d, 1))}>
            <span className="hidden sm:inline">{format(addMonths(current, 1), 'MMM')}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Scrollable grid ── */}
        <div className="overflow-x-auto">
          <table className="border-collapse table-fixed" style={{ width: totalW, minWidth: totalW }}>

            {/* ── Day header row ── */}
            <thead>
              <tr className="border-b bg-muted/40">
                {/* Property label */}
                <th
                  className="sticky left-0 z-20 border-r bg-muted/40 text-left px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
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
                      className={[
                        'border-r px-1 py-2 text-center',
                        isToday   ? 'bg-primary/15' :
                        isWeekend ? 'bg-muted/30'   : '',
                      ].join(' ')}
                      style={{ width: DAY_W, minWidth: DAY_W }}
                    >
                      <div className={`text-[10px] font-semibold uppercase tracking-wide
                        ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-lg font-bold leading-none mt-0.5
                        ${isToday ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      {count > 0 && (
                        <span className={`mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full
                          ${isToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {count}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>

            {/* ── Property rows ── */}
            <tbody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="sticky left-0 z-10 bg-card border-r px-3 py-3">
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
                    className={`border-b ${ri % 2 === 1 ? 'bg-muted/5' : ''}`}
                    style={{ height: ROW_H }}
                  >
                    {/* ── Sticky property name cell ── */}
                    <td
                      className={`sticky left-0 z-10 border-r px-3 py-2 align-middle
                        ${ri % 2 === 1 ? 'bg-muted/5' : 'bg-card'}`}
                      style={{ width: ROOM_W, minWidth: ROOM_W }}
                    >
                      <div className="font-semibold text-sm leading-tight">{prop.name}</div>
                      <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{prop.type}</div>
                    </td>

                    {/* ── Day cells ── */}
                    {days.map(day => {
                      const bks     = cellBookings(prop.id, day)
                      const isToday   = isSameDay(day, today)
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6

                      return (
                        <td
                          key={day.toISOString()}
                          className={[
                            'border-r px-0.5 py-0.5 align-top',
                            isToday   ? 'bg-primary/5'  :
                            isWeekend ? 'bg-muted/10'   : '',
                          ].join(' ')}
                          style={{ width: DAY_W, minWidth: DAY_W }}
                        >
                          <div className="flex flex-col gap-0.5">
                            {bks.map(b => {
                              const slot   = slotType(b, day)!
                              const c      = S[b.status] || S.CONFIRMED
                              const ci     = parseISO(b.checkIn)
                              const co     = parseISO(b.checkOut)

                              // Border-radius connects multi-day bookings visually
                              const radius =
                                slot === 'single'   ? 'rounded mx-0.5' :
                                slot === 'checkin'  ? 'rounded-l ml-0.5' :
                                slot === 'checkout' ? 'rounded-r mr-0.5' :
                                                      '' // middle: no radius, full width

                              return (
                                <Link
                                  key={b.id}
                                  href="/dashboard/bookings"
                                  title={`${b.guestName} · ${prop.name}\n${format(ci, 'MMM d, h:mm a')} → ${format(co, 'MMM d, h:mm a')}\n${money(b.rate)}`}
                                  className={`block overflow-hidden px-1.5 py-1 text-[10px] leading-tight
                                    hover:brightness-110 transition-all cursor-pointer
                                    ${c.bg} ${c.text} ${radius}`}
                                >
                                  {/* Check-in day: full info */}
                                  {(slot === 'checkin' || slot === 'single') && (
                                    <>
                                      <div className="font-bold truncate">{b.guestName}</div>
                                      <div className="opacity-90 mt-0.5">
                                        {format(ci, 'h:mm a')} – {format(co, 'h:mm a')}
                                      </div>
                                      <div className="font-semibold opacity-90">{money(b.rate)}</div>
                                    </>
                                  )}

                                  {/* Middle days: just name */}
                                  {slot === 'middle' && (
                                    <div className="font-semibold truncate opacity-80 py-0.5">
                                      {b.guestName}
                                    </div>
                                  )}

                                  {/* Check-out day: name + checkout time */}
                                  {slot === 'checkout' && (
                                    <>
                                      <div className="font-semibold truncate opacity-80">{b.guestName}</div>
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

        {/* ── Legend ── */}
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
              <div className={`h-3 w-3 rounded-sm ${color}`} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">Scroll horizontally to see all days →</span>
        </div>
      </Card>
    </div>
  )
}
