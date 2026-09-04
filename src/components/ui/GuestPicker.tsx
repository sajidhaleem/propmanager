'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { IdCard, X, ArrowUpRight, ChevronDown, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Guest } from '@/lib/guests'

interface Props {
  /** The guest profile this booking is linked to, if any. */
  value?: string
  /** The name typed on the booking — also the search term. */
  guestName?: string
  onNameChange: (name: string) => void
  onPick: (guest: Guest) => void
  onClear: () => void
}

/**
 * The guest name field, with the saved register behind it.
 *
 * Typing searches profiles as you go, so a returning guest is picked rather
 * than retyped — which is what stopped one person becoming three profiles with
 * three spellings. A name that matches nobody is still accepted as typed: the
 * desk should never be blocked from taking a booking because the profile does
 * not exist yet.
 *
 * Scanning deliberately is not here — it lives on the guest profile, so one
 * card read serves every future stay.
 */
export function GuestPicker({ value, guestName, onNameChange, onPick, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const search = (guestName || '').trim()
  const { data, isFetching } = useQuery({
    queryKey: ['guests', 'picker', search],
    queryFn: async () => {
      const res = await fetch(`/api/guests?${new URLSearchParams({ search, limit: '8' })}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    // Linked already: the list is not being chosen from, so do not keep asking
    enabled: open && !value && search.length >= 2,
  })
  const results: Guest[] = data?.data || []

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => { setActive(0) }, [search])

  function pick(g: Guest) {
    onPick(g)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + results.length) % results.length) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  const showList = open && !value && search.length >= 2

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Input
          value={guestName || ''}
          onChange={e => { onNameChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Type to search saved guests, or enter a new name"
          role="combobox"
          // The visible <Label> is a sibling, not a wrapper, so name it here
          aria-label="Guest name"
          aria-expanded={showList}
          aria-autocomplete="list"
          className={cn('pr-9', value && 'pr-24')}
        />

        {value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Unlink this booking from the saved profile"
            title="Unlink this booking from the saved profile"
            className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <IdCard className="h-3 w-3" />Linked<X className="h-3 w-3" />
          </button>
        ) : (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </div>

      {showList && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
          {isFetching && results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <p className="text-sm text-muted-foreground">
                No saved guest — “{search}” will be booked as typed.
              </p>
              <Link
                href="/dashboard/guests"
                target="_blank"
                className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                New<ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            results.map((g, i) => (
              <button
                key={g.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(g)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                  i === active ? 'bg-accent' : 'hover:bg-accent/60'
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {g.name[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[g.cnic, g.passportNumber, g.phone].filter(Boolean).join(' · ') || 'No identity saved'}
                  </span>
                </span>
                {!!g._count?.bookings && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {g._count.bookings} stay{g._count.bookings === 1 ? '' : 's'}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
