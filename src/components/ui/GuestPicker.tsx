'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search, IdCard, X, ArrowUpRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Guest } from '@/lib/guests'

interface Props {
  value?: string
  guestName?: string
  onPick: (guest: Guest) => void
  onClear: () => void
}

/**
 * Attaches a booking to a saved guest. Scanning deliberately is not here — it
 * lives on the guest profile, so one card read serves every future stay instead
 * of the same person being scanned and retyped on each booking.
 */
export function GuestPicker({ value, guestName, onPick, onClear }: Props) {
  const [search, setSearch] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['guests', 'picker', search],
    queryFn: async () => {
      const res = await fetch(`/api/guests?${new URLSearchParams({ search, limit: '8' })}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: search.trim().length >= 2,
  })
  const results: Guest[] = data?.data || []

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
        <IdCard className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{guestName || 'Saved guest'}</p>
          <p className="text-xs text-muted-foreground">Linked to a guest profile</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-3.5 w-3.5" />Unlink
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed bg-muted/30 p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Find a saved guest by name, CNIC or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {search.trim().length >= 2 && (
        <div className="max-h-52 overflow-y-auto rounded-lg border bg-background">
          {isFetching && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <p className="text-sm text-muted-foreground">No saved guest matches.</p>
              <Link
                href="/dashboard/guests"
                target="_blank"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                New guest<ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            results.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => { onPick(g); setSearch('') }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
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
              </button>
            ))
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Scanning a CNIC or passport now happens on the{' '}
        <Link href="/dashboard/guests" target="_blank" className="font-medium text-primary hover:underline">
          guest profile
        </Link>
        , so a returning guest is only ever read once.
      </p>
    </div>
  )
}
