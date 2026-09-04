'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, IdCard, Plane, CalendarDays } from 'lucide-react'
import { PageHero, HERO_CONTROL } from '@/components/layout/PageHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SortableTh } from '@/components/ui/sortable-th'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { CnicScanner, type CnicData } from '@/components/ui/CnicScanner'
import { PassportScanner, type PassportData } from '@/components/ui/PassportScanner'
import { formatDate } from '@/lib/utils'
import type { ScannedImage } from '@/types'
import type { Guest } from '@/lib/guests'

/** An empty cell reads as missing data, not as a value someone forgot to check. */
const Dash = () => <span className="text-muted-foreground/50">—</span>

const EMPTY: Omit<Guest, 'id' | '_count'> = {
  name: '', email: '', phone: '', cnic: '', fatherName: '', gender: '', address: '',
  province: '', district: '', passportNumber: '', nationality: '', passportExpiry: '', notes: '',
}

export default function GuestsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Guest | null>(null)
  const [deleting, setDeleting] = useState<Guest | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [pendingScans, setPendingScans] = useState<ScannedImage[]>([])
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

  // Stay history, loaded only for the profile that is open
  const { data: detail } = useQuery({
    queryKey: ['guest', editing?.id],
    queryFn: async () => {
      const res = await fetch(`/api/guests/${editing!.id}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: !!editing?.id,
  })
  const stays = detail?.data?.bookings || []

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY) => {
      const res = await fetch(editing ? `/api/guests/${editing.id}` : '/api/guests', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not save the guest')

      /* A new profile has no id until this returns, so scans wait in state and
         are filed here. The card image is the evidence behind a filing — losing
         it because the guest was new would defeat the point of keeping it. */
      const guestId = json.data?.id
      if (guestId && pendingScans.length > 0) {
        for (const scan of pendingScans) {
          const body = new FormData()
          body.append('file', scan.file)
          await fetch(`/api/guests/${guestId}/documents`, { method: 'POST', body })
            .catch(() => toast.error(`Could not save the ${scan.label} image`))
        }
      }
      return json
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] })
      toast.success(editing ? 'Guest updated' : 'Guest profile created')
      setPendingScans([])
      setModalOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
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
    setForm(EMPTY)
    setPendingScans([])
    setModalOpen(true)
  }

  function openEdit(g: Guest) {
    setEditing(g)
    setForm({ ...EMPTY, ...g, _count: undefined } as typeof EMPTY)
    setPendingScans([])
    setModalOpen(true)
  }

  /* Scanning lives here rather than on the booking form, so a repeat guest is
     read from their card once and every later stay reuses the profile. */
  function applyCnic(d: CnicData, scan?: ScannedImage) {
    setForm(f => ({
      ...f,
      name:       d.name        || f.name,
      fatherName: d.father_name || f.fatherName,
      cnic:       d.cnic        || f.cnic,
      gender:     d.gender      || f.gender,
      address:    d.address     || f.address,
    }))
    if (scan) setPendingScans(s => [...s, scan])
    toast.success('CNIC read — check the fields before saving')
  }

  function applyPassport(d: PassportData, scan?: ScannedImage) {
    setForm(f => ({
      ...f,
      name:           d.name            || f.name,
      passportNumber: d.passport_number || f.passportNumber,
      nationality:    d.nationality     || f.nationality,
      gender:         d.gender          || f.gender,
      passportExpiry: d.expiry_date     || f.passportExpiry,
    }))
    if (scan) setPendingScans(s => [...s, scan])
    toast.success('Passport read — check the fields before saving')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2) { toast.error('Enter the guest name'); return }
    saveMutation.mutate(form)
  }

  const field = (key: keyof typeof EMPTY, label: string, placeholder = '') => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={(form[key] as string) || ''}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  )

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
                          <p className="font-medium">{g.name}</p>
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

      {/* Profile */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'New guest profile'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <CnicScanner onExtracted={applyCnic} />
              <PassportScanner onExtracted={applyPassport} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {field('name', 'Full name', 'Guest name')}
              {field('fatherName', "Father's name")}
              {field('cnic', 'CNIC', '12345-1234567-1')}
              {field('phone', 'Phone')}
              {field('gender', 'Gender')}
              {field('email', 'Email')}
              {field('passportNumber', 'Passport number')}
              {field('nationality', 'Nationality')}
              {field('passportExpiry', 'Passport expiry')}
              {field('province', 'Province')}
              {field('district', 'District')}
              {field('notes', 'Notes')}
            </div>
            <div className="sm:col-span-2">{field('address', 'Address')}</div>

            {editing && stays.length > 0 && (
              <div className="rounded-xl border">
                <p className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
                  <CalendarDays className="h-4 w-4" />Stay history
                </p>
                <div className="divide-y">
                  {stays.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span>{formatDate(s.checkIn, 'MMM d, yyyy')} — {s.property?.name}</span>
                      <Badge variant="outline">{s.hotelEyeStatus === 'ENTERED' ? 'Filed' : 'Not filed'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create profile'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
