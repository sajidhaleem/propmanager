'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, IdCard, Plane } from 'lucide-react'
import { PageHero, HERO_CONTROL } from '@/components/layout/PageHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SortableTh } from '@/components/ui/sortable-th'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { GuestFormDialog } from '@/components/guests/GuestFormDialog'
import type { Guest } from '@/lib/guests'

/** An empty cell reads as missing data, not as a value someone forgot to check. */
const Dash = () => <span className="text-muted-foreground/50">—</span>

export default function GuestsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Guest | null>(null)
  const [deleting, setDeleting] = useState<Guest | null>(null)
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  function handleSort(field: string) {
    if (field === sortBy) setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(field); setSortOrder('asc') }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['guests', search],
    queryFn: async () => {
      const res = await fetch(`/api/guests?${new URLSearchParams(search ? { search } : {})}`)
      if (!res.ok) throw new Error('Failed to load guests')
      return res.json()
    },
  })
  const guests: Guest[] = data?.data || []

  /* Sorted here rather than server-side: the list is already capped at 200 and
     search does the narrowing, so a round trip per column click buys nothing. */
  const sortedGuests = [...guests].sort((a, b) => {
    const dir = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'stays') return ((a._count?.bookings ?? 0) - (b._count?.bookings ?? 0)) * dir
    const av = (a[sortBy as keyof Guest] as string) || ''
    const bv = (b[sortBy as keyof Guest] as string) || ''
    // Blank fields sort last in either direction — an empty CNIC is not "first"
    if (!av !== !bv) return av ? -1 : 1
    return av.localeCompare(bv) * dir
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/guests/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Could not delete')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] })
      toast.success('Guest profile deleted — their stays are untouched')
      setDeleting(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openNew() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(g: Guest) {
    setEditing(g)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHero title="Guests" description={`${guests.length} profile${guests.length === 1 ? '' : 's'}`}>
        <Button onClick={openNew} className={HERO_CONTROL}>
          <Plus className="mr-2 h-4 w-4" />New guest
        </Button>
      </PageHero>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, CNIC, phone or passport…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : guests.length === 0 ? (
        <EmptyState
          icon={IdCard}
          title={search ? 'No guest matches that' : 'No guest profiles yet'}
          description={search ? 'Try a different name or CNIC.' : 'Create a profile and scan the card once — every later stay reuses it.'}
        />
      ) : (
        /* The register a desk actually reads: every saved detail on the row.
           Scrolls sideways in its own container rather than pushing the page. */
        <div className="rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <SortableTh label="Guest"     field="name"           sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="CNIC"      field="cnic"           sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Father"    field="fatherName"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Phone"     field="phone"          sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Passport"  field="passportNumber" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Address"   field="address"        sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Stays"     field="stays"          sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedGuests.map(g => (
                  <tr key={g.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                          {g.name[0]?.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          {/* The name opens the profile board — the row itself
                              stays clickable-free so Edit and Delete still work. */}
                          <Link href={`/dashboard/guests/${g.id}`} className="font-medium hover:underline">
                            {g.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {[g.gender, g.nationality].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{g.cnic || <Dash />}</td>
                    <td className="px-4 py-3">{g.fatherName || <Dash />}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{g.phone || <Dash />}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {g.passportNumber
                        ? <span className="inline-flex items-center gap-1.5"><Plane className="h-3.5 w-3.5 text-muted-foreground" />{g.passportNumber}</span>
                        : <Dash />}
                    </td>
                    <td className="max-w-[22ch] truncate px-4 py-3" title={g.address || undefined}>
                      {g.address || <Dash />}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{g._count?.bookings ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(g)} aria-label={`Edit ${g.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(g)} aria-label={`Delete ${g.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GuestFormDialog open={modalOpen} onOpenChange={setModalOpen} guest={editing} />

      {/* Delete */}
      <Dialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete {deleting?.name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The profile is removed. Their bookings stay exactly as they are — including anything already filed on Hotel Eye.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
