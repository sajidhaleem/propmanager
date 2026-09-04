'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Pencil, IdCard, Plane, ScanLine, ChevronDown, ChevronRight,
  Phone, MapPin, ShieldCheck, Check, CalendarDays, Download, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GuestFormDialog } from '@/components/guests/GuestFormDialog'
import { cn, formatDate } from '@/lib/utils'
import { getFilingStatus, FILING_WINDOW_HOURS } from '@/lib/hotelEye'
import {
  filingChecklist, completeness, nightsByMonth, filingMix, openFiling, totalNights,
  type Stay,
} from '@/lib/guestProfile'
import type { Guest } from '@/lib/guests'

type GuestDoc = { id: string; name: string; mimeType: string; size: number; createdAt: string }
type GuestDetail = Guest & { bookings: Stay[]; documents: GuestDoc[] }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export default function GuestProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [editOpen, setEditOpen] = useState(false)
  const [docIndex, setDocIndex] = useState(0)
  const [month, setMonth] = useState(() => new Date())

  const { data, isLoading } = useQuery({
    queryKey: ['guest', id],
    queryFn: async () => {
      const res = await fetch(`/api/guests/${id}`)
      if (!res.ok) throw new Error('Could not load this guest')
      return res.json()
    },
  })
  const guest: GuestDetail | undefined = data?.data

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Skeleton className="h-28 w-full rounded-[20px]" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96 rounded-[20px]" />
          <Skeleton className="h-96 rounded-[20px]" />
        </div>
      </div>
    )
  }

  if (!guest) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">That guest profile no longer exists.</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/dashboard/guests">Back to guests</Link></Button>
      </div>
    )
  }

  const stays = guest.bookings ?? []
  const docs = guest.documents ?? []
  const cardOnFile = docs.length > 0
  const doc = docs[Math.min(docIndex, docs.length - 1)]

  const mix = filingMix(stays)
  const nights = totalNights(stays)
  const filedCount = mix.counts.filed
  const chart = nightsByMonth(stays)
  const peak = Math.max(1, ...chart.map(c => c.nights))
  const open = openFiling(stays)
  const comp = completeness(guest, cardOnFile)
  const checklist = filingChecklist(guest, cardOnFile)

  const monthStays = stays
    .filter(s => {
      const d = new Date(s.checkIn)
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
    })
    .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())

  const shiftMonth = (by: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + by, 1))
  const docUrl = doc ? `/api/guests/${guest.id}/documents/${doc.id}?inline=1` : null
  const documentLabel = guest.cnic ? 'CNIC' : guest.passportNumber ? 'Passport' : 'No document'

  /* A board floating on the app's canvas, as the design it follows is.
     Deliberately not overflow-hidden: that would make this the sticky card
     column's scroll box, and the card would stop following the page. */
  return (
    <div className="guest-board rounded-[24px] border border-[hsl(var(--gb-line))] p-4 lg:p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">

        {/* ── Header: who this is, and the record at a glance ─────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/dashboard/guests"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--gb-muted))] hover:text-[hsl(var(--gb-ink))]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />All guests
            </Link>
            <h1 className="font-display mt-1 text-[2rem] font-semibold leading-tight tracking-tight">
              {guest.name}
            </h1>
            <p className="mt-0.5 text-sm text-[hsl(var(--gb-muted))]">
              {[guest.cnic && `CNIC ${guest.cnic}`, guest.passportNumber && `Passport ${guest.passportNumber}`, guest.nationality]
                .filter(Boolean).join('  ·  ') || 'No identity document on file yet'}
            </p>
          </div>

          <div className="flex items-end gap-6">
            <Stat value={stays.length} label="Stays" />
            <Stat value={nights} label="Nights" />
            <Stat value={filedCount} label="Filed" />
            <Button
              size="sm"
              onClick={() => setEditOpen(true)}
              className="rounded-full bg-[hsl(var(--gb-dark))] text-[hsl(var(--gb-on-dark))] hover:bg-[hsl(var(--gb-dark))]/90"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit profile
            </Button>
          </div>
        </div>

        {/* Filing record across every stay */}
        <FilingMixBar mix={mix} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Main board ──────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <NightsTile chart={chart} peak={peak} nights={nights} />
              <FilingWindowTile open={open} />
              <CompletenessTile comp={comp} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <StayHistoryTile
                month={month}
                onShift={shiftMonth}
                stays={monthStays}
              />
              <ChecklistTile items={checklist} done={comp.done} total={comp.total} />
            </div>

            <DetailAccordions guest={guest} docs={docs} />
          </div>

          {/* ── The scanned card, always in view ────────────────────────── */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="gb-tile overflow-hidden">
              {/* Landscape frame with object-contain: a CNIC is a wide card, and
                  object-cover would crop off the number and the name — the two
                  things the desk opens this panel to read. */}
              <div className="relative aspect-[4/3] bg-[hsl(var(--gb-dark))]">
                {docUrl ? (
                  doc!.mimeType === 'application/pdf' ? (
                    <object data={docUrl} type="application/pdf" className="h-full w-full">
                      <p className="p-4 text-sm text-[hsl(var(--gb-muted))]">Preview unavailable.</p>
                    </object>
                  ) : (
                    <a href={docUrl} target="_blank" rel="noreferrer" title="Open the full-size scan" className="block h-full w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served from our own
                          API as a private, auth-gated blob; the optimizer cannot fetch it */}
                      <img src={docUrl} alt={`Scanned ${documentLabel} for ${guest.name}`} className="h-full w-full object-contain" />
                    </a>
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                    <ScanLine className="h-8 w-8 text-[hsl(var(--gb-muted))]" />
                    <p className="text-sm font-medium">No card scanned yet</p>
                    <p className="text-xs text-[hsl(var(--gb-muted))]">
                      A filing is evidenced by the card image. Scan it once and every later stay reuses it.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Scan now</Button>
                  </div>
                )}

                {/* Name plate, as on a card sleeve. Only over an actual scan —
                    over the empty state it would sit on top of the Scan button. */}
                {docUrl && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{guest.name}</p>
                    <p className="truncate text-[11px] text-white/70">
                      {[guest.fatherName && `s/o ${guest.fatherName}`, guest.gender].filter(Boolean).join(' · ') || 'Guest'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[hsl(var(--gb-accent))] px-2.5 py-1 text-[11px] font-semibold text-[hsl(30_22%_13%)]">
                    {documentLabel}
                  </span>
                </div>
                )}
              </div>

              {docs.length > 0 && (
                <div className="space-y-2 p-3">
                  {docs.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {docs.map((d, i) => (
                        <button
                          key={d.id}
                          onClick={() => setDocIndex(i)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                            i === docIndex
                              ? 'border-transparent bg-[hsl(var(--gb-dark))] text-[hsl(var(--gb-on-dark))]'
                              : 'border-[hsl(var(--gb-line))] text-[hsl(var(--gb-muted))] hover:text-[hsl(var(--gb-ink))]'
                          )}
                        >
                          Scan {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[hsl(var(--gb-muted))]">
                    <span className="truncate" title={doc!.name}>{formatDate(doc!.createdAt, 'MMM d, yyyy')}</span>
                    <a
                      href={`/api/guests/${guest.id}/documents/${doc!.id}`}
                      className="inline-flex items-center gap-1 font-medium text-[hsl(var(--gb-ink))] hover:underline"
                    >
                      <Download className="h-3 w-3" />Download
                    </a>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <GuestFormDialog open={editOpen} onOpenChange={setEditOpen} guest={guest} />
    </div>
  )
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-right">
      <p className="font-display text-[2rem] font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-[hsl(var(--gb-muted))]">{label}</p>
    </div>
  )
}

function FilingMixBar({ mix }: { mix: ReturnType<typeof filingMix> }) {
  if (mix.total === 0) {
    return (
      <p className="text-xs text-[hsl(var(--gb-muted))]">No stays recorded for this guest yet.</p>
    )
  }
  const segments = [
    { label: 'Filed',     pct: mix.filed,   className: 'bg-[hsl(var(--gb-dark))] text-[hsl(var(--gb-on-dark))]' },
    { label: 'Filing',    pct: mix.filing,  className: 'bg-[hsl(var(--gb-accent))] text-[hsl(30_22%_13%)]' },
    { label: 'Not filed', pct: mix.unfiled, className: 'bg-[hsl(var(--gb-line))] text-[hsl(var(--gb-ink))]' },
    { label: 'Overdue',   pct: mix.overdue, className: 'bg-rose-500 text-white' },
  ].filter(s => s.pct > 0)

  return (
    <div className="flex gap-1.5">
      {segments.map(s => (
        /* Proportional flex, not a width: percentages plus gaps overflow the
           track once three or four segments are present. The label rides above
           its own bar so the two can never drift apart. */
        <div key={s.label} style={{ flex: `${Math.max(s.pct, 10)} 1 0%` }} className="min-w-0 space-y-1">
          <p className="truncate text-[11px] font-medium text-[hsl(var(--gb-muted))]">{s.label}</p>
          <div className={cn('flex h-7 items-center justify-center rounded-full text-[11px] font-semibold', s.className)}>
            {s.pct}%
          </div>
        </div>
      ))}
    </div>
  )
}

function TileHead({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-semibold">{title}</p>
      {href && (
        <Link
          href={href}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--gb-line))] text-[hsl(var(--gb-muted))] transition-colors hover:text-[hsl(var(--gb-ink))]"
          aria-label={`Open ${title}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

function NightsTile({ chart, peak, nights }: { chart: ReturnType<typeof nightsByMonth>; peak: number; nights: number }) {
  const busiest = chart.reduce((best, c) => (c.nights > best.nights ? c : best), chart[0])
  return (
    <div className="gb-tile space-y-4 p-4">
      <TileHead title="Nights stayed" />
      <div>
        <p className="font-display text-3xl font-semibold leading-none tabular-nums">
          {nights}<span className="ml-1 text-lg">n</span>
        </p>
        <p className="mt-1 text-xs text-[hsl(var(--gb-muted))]">Across every stay</p>
      </div>

      <div className="relative flex h-24 items-end justify-between gap-1.5">
        {chart.map(c => {
          const isPeak = c.nights > 0 && c.nights === busiest.nights
          return (
            <div key={c.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-16 w-full items-end">
                <div
                  style={{ height: `${Math.max((c.nights / peak) * 100, 4)}%` }}
                  className={cn(
                    'w-full rounded-full',
                    isPeak ? 'bg-[hsl(var(--gb-accent))]' : 'bg-[hsl(var(--gb-dark))]/25'
                  )}
                  title={`${c.nights} night${c.nights === 1 ? '' : 's'} in ${MONTHS[c.date.getMonth()]}`}
                />
              </div>
              <span className="text-[10px] font-medium text-[hsl(var(--gb-muted))]">
                {MONTHS[c.date.getMonth()][0]}
              </span>
            </div>
          )
        })}
        {busiest.nights > 0 && (
          <span className="pointer-events-none absolute right-0 top-0 rounded-full bg-[hsl(var(--gb-accent))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(30_22%_13%)]">
            {busiest.nights}n peak
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * The 24-hour statutory clock for this guest's outstanding stay. The ring
 * empties as the window does — the one tile on the board with a deadline.
 */
function FilingWindowTile({ open }: { open: ReturnType<typeof openFiling> }) {
  const R = 42
  const C = 2 * Math.PI * R
  const remaining = open ? Math.max(0, Math.min(1, open.status.hoursRemaining / FILING_WINDOW_HOURS)) : 1
  const overdue = !!open && open.status.hoursRemaining <= 0

  const centre = !open
    ? 'Clear'
    : overdue
      ? open.status.label
      : `${String(Math.floor(open.status.hoursRemaining)).padStart(2, '0')}:${String(Math.round((open.status.hoursRemaining % 1) * 60)).padStart(2, '0')}`

  return (
    <div className="gb-tile space-y-3 p-4">
      <TileHead title="Filing window" href={`/dashboard/bookings?view=hoteleye`} />

      <div className="flex justify-center py-1">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" className="stroke-[hsl(var(--gb-line))]" />
            <circle
              cx="50" cy="50" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - remaining)}
              className={cn(overdue ? 'stroke-rose-500' : !open ? 'stroke-emerald-500' : 'stroke-[hsl(var(--gb-accent))]')}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-xl font-semibold tabular-nums">{centre}</span>
            <span className="text-[10px] text-[hsl(var(--gb-muted))]">
              {open ? 'left to file' : 'nothing due'}
            </span>
          </div>
        </div>
      </div>

      {open ? (
        <Link
          href={`/dashboard/bookings?view=hoteleye&search=${encodeURIComponent(open.stay.property?.name || '')}`}
          className="flex items-center justify-between gap-2 rounded-full border border-[hsl(var(--gb-line))] px-3 py-2 text-xs font-medium transition-colors hover:bg-[hsl(var(--gb-line))]/40"
        >
          <span className="truncate">
            {formatDate(open.stay.checkIn, 'MMM d')} · {open.stay.property?.name || 'Stay'}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </Link>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-[hsl(var(--gb-muted))]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />Every stay is on the portal
        </p>
      )}
    </div>
  )
}

function CompletenessTile({ comp }: { comp: ReturnType<typeof completeness> }) {
  const bars = [
    { label: 'Identity', pct: comp.identity, className: 'bg-[hsl(var(--gb-accent))]' },
    { label: 'Contact',  pct: comp.contact,  className: 'bg-[hsl(var(--gb-dark))]' },
    { label: 'Travel',   pct: comp.travel,   className: 'bg-[hsl(var(--gb-line))]' },
  ]
  return (
    <div className="gb-tile space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">Profile completeness</p>
        <p className="font-display text-lg font-semibold tabular-nums">{comp.overall}%</p>
      </div>

      <div className="flex items-end gap-2">
        {bars.map(b => (
          <div key={b.label} className="flex-1 space-y-1.5">
            <p className="text-[11px] font-medium text-[hsl(var(--gb-muted))] tabular-nums">{b.pct}%</p>
            {/* Height rather than scaleY: a scaled bar stretches its corner radius */}
            <div className="flex h-14 w-full items-end rounded-xl bg-[hsl(var(--gb-line))]/50">
              <div
                className={cn('w-full rounded-xl', b.className)}
                style={{ height: `${Math.max(b.pct, 6)}%` }}
              />
            </div>
            <p className="truncate text-[11px] font-medium">{b.label}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-[hsl(var(--gb-muted))]">
        {comp.done} of {comp.total} filing fields recorded
      </p>
    </div>
  )
}

function ChecklistTile({ items, done, total }: { items: ReturnType<typeof filingChecklist>; done: number; total: number }) {
  const ICONS = [IdCard, ScanLine, Phone, ShieldCheck, MapPin, MapPin, Phone, ScanLine]
  return (
    <div className="rounded-[20px] bg-[hsl(var(--gb-dark))] p-4 text-[hsl(var(--gb-on-dark))]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Filing checklist</p>
        <p className="font-display text-lg font-semibold tabular-nums">{done}/{total}</p>
      </div>

      <div className="mt-3 space-y-0.5">
        {items.map((item, i) => {
          const Icon = ICONS[i] ?? IdCard
          return (
            <div key={item.key} className="flex items-center gap-3 rounded-xl px-1.5 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{item.label}</span>
                <span className="block truncate text-[11px] text-white/50">{item.hint}</span>
              </span>
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                  item.done ? 'bg-[hsl(var(--gb-accent))] text-[hsl(30_22%_13%)]' : 'border border-white/25'
                )}
                aria-label={item.done ? `${item.label} recorded` : `${item.label} missing`}
              >
                {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StayHistoryTile({
  month, onShift, stays,
}: { month: Date; onShift: (by: number) => void; stays: Stay[] }) {
  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1)
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1)

  return (
    <div className="gb-tile flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => onShift(-1)} className="text-xs font-medium text-[hsl(var(--gb-muted))] hover:text-[hsl(var(--gb-ink))]">
          {MONTHS[prev.getMonth()]}
        </button>
        <p className="text-sm font-semibold">{MONTHS[month.getMonth()]} {month.getFullYear()}</p>
        <button onClick={() => onShift(1)} className="rounded-full border border-[hsl(var(--gb-line))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--gb-muted))] hover:text-[hsl(var(--gb-ink))]">
          {MONTHS[next.getMonth()]}
        </button>
      </div>

      <div className="mt-3 flex-1 space-y-2">
        {stays.length === 0 ? (
          <p className="flex h-full min-h-[9rem] items-center justify-center gap-2 text-xs text-[hsl(var(--gb-muted))]">
            <CalendarDays className="h-3.5 w-3.5" />No stay this month
          </p>
        ) : (
          stays.map(s => {
            const fs = getFilingStatus(s)
            return (
              <div key={s.id} className="flex items-stretch gap-3">
                <div className="w-12 shrink-0 pt-1 text-right">
                  <p className="text-[11px] font-semibold tabular-nums">{formatDate(s.checkIn, 'd')}</p>
                  <p className="text-[10px] text-[hsl(var(--gb-muted))]">{formatDate(s.checkIn, 'EEE')}</p>
                </div>
                <div className="flex-1 rounded-xl bg-[hsl(var(--gb-dark))] px-3 py-2 text-[hsl(var(--gb-on-dark))]">
                  <p className="truncate text-[13px] font-medium">{s.property?.name || 'Stay'}</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-white/55">
                    {formatDate(s.checkIn, 'h:mm a')} — {formatDate(s.checkOut, 'MMM d')}
                    <span className={cn(
                      'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      fs.state === 'FILED'
                        ? 'bg-emerald-400/20 text-emerald-300'
                        : fs.state === 'OVERDUE' || fs.state === 'FAILED'
                          ? 'bg-rose-400/20 text-rose-300'
                          : 'bg-[hsl(var(--gb-accent))]/25 text-[hsl(var(--gb-accent))]'
                    )}>
                      {fs.label}
                    </span>
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function DetailAccordions({ guest, docs }: { guest: GuestDetail; docs: GuestDoc[] }) {
  const sections = [
    {
      key: 'identity',
      label: 'Identity document',
      icon: IdCard,
      rows: [
        ['CNIC', guest.cnic],
        ["Father's name", guest.fatherName],
        ['Gender', guest.gender],
        ['Scans on file', docs.length ? `${docs.length} image${docs.length === 1 ? '' : 's'}` : null],
      ] as [string, string | null | undefined][],
    },
    {
      key: 'contact',
      label: 'Contact',
      icon: Phone,
      rows: [['Phone', guest.phone], ['Email', guest.email]] as [string, string | null | undefined][],
    },
    {
      key: 'address',
      label: 'Address',
      icon: MapPin,
      rows: [['Address', guest.address], ['Province', guest.province], ['District', guest.district]] as [string, string | null | undefined][],
    },
    {
      key: 'travel',
      label: 'Travel document',
      icon: Plane,
      rows: [
        ['Passport', guest.passportNumber],
        ['Nationality', guest.nationality],
        ['Expiry', guest.passportExpiry],
      ] as [string, string | null | undefined][],
    },
  ]

  // Identity opens by default — it is the section a filing actually needs
  const [open, setOpen] = useState<string | null>('identity')

  return (
    <div className="gb-tile divide-y divide-[hsl(var(--gb-line))]">
      {sections.map(s => {
        const isOpen = open === s.key
        const filled = s.rows.filter(([, v]) => v && String(v).trim()).length
        return (
          <div key={s.key}>
            <button
              onClick={() => setOpen(o => (o === s.key ? null : s.key))}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <s.icon className="h-4 w-4 shrink-0 text-[hsl(var(--gb-muted))]" />
              <span className="flex-1 text-sm font-medium">{s.label}</span>
              <span className="text-[11px] tabular-nums text-[hsl(var(--gb-muted))]">{filled}/{s.rows.length}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-[hsl(var(--gb-muted))] transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <dl className="space-y-1.5 px-4 pb-3.5">
                {s.rows.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
                    <dt className="shrink-0 text-[hsl(var(--gb-muted))]">{label}</dt>
                    <dd className={cn('truncate text-right', !value && 'text-[hsl(var(--gb-muted))]/60')}>
                      {value || 'Not recorded'}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )
      })}
    </div>
  )
}
