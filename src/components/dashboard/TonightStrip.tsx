'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Tonight's filing position, on the first screen of the shift.
 *
 * The dashboard carried revenue, occupancy and expenses but said nothing about
 * the only thing here with a legal deadline. Hotel Eye lived in a card on the
 * sidebar rail and nowhere else, so the number a desk is actually judged on was
 * the one number the morning screen left out.
 *
 * Severity is by exposure: anything past the 24-hour window outranks a clean
 * day, because that is the one an inspector would find.
 */

type Compliance = {
  arrivalsToday: number
  filedToday: number
  overdue: number
  failed: number
  clear: boolean
  windowHours: number
}

export function TonightStrip() {
  const { data } = useQuery({
    queryKey: ['hotel-eye', 'compliance'],
    queryFn: async () => {
      const res = await fetch('/api/hotel-eye/compliance')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 5 * 60 * 1000,
  })
  const c: Compliance | undefined = data?.data
  if (!c) return null

  const exposed = c.overdue > 0 || c.failed > 0
  const outstanding = Math.max(0, c.arrivalsToday - c.filedToday)

  /* Exposure lives in the All view: a stay past its window is by definition not
     in the Hotel Eye list, which holds what is already on the portal. */
  const href = exposed
    ? '/dashboard/bookings?view=all&filter=OVERDUE'
    : outstanding > 0
      ? '/dashboard/bookings?view=all&filter=NOT_ENTERED'
      : '/dashboard/bookings?view=hoteleye'

  return (
    <Link
      href={href}
      className={cn(
        'surface card-hover group flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4',
        exposed && 'border-destructive/40 bg-destructive/[0.06]'
      )}
    >
      <span className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            exposed ? 'bg-destructive/15 text-destructive'
              : c.clear ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-primary/15 text-primary'
          )}
        >
          {exposed ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Hotel Eye tonight
          </span>
          <span className="block text-sm font-medium">
            {exposed
              ? 'Needs filing now'
              : c.clear ? 'Every arrival is on the portal'
                : outstanding > 0 ? `${outstanding} still to file` : 'Nothing due'}
          </span>
        </span>
      </span>

      <Figure label="Filed today" value={`${c.filedToday} / ${c.arrivalsToday}`} />
      <Figure
        label={`Past ${c.windowHours}h`}
        value={c.overdue}
        tone={c.overdue > 0 ? 'bad' : undefined}
      />
      <Figure label="Failed" value={c.failed} tone={c.failed > 0 ? 'bad' : undefined} />

      <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        <Clock className="h-3.5 w-3.5" />
        {exposed ? 'Open the exposure' : 'Open the register'}
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

function Figure({ label, value, tone }: { label: string; value: string | number; tone?: 'bad' }) {
  return (
    <span className="leading-tight">
      <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className={cn('block text-lg font-semibold tabular-nums', tone === 'bad' && 'text-destructive')}>
        {value}
      </span>
    </span>
  )
}
