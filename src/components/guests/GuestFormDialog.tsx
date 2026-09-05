'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { type CnicData } from '@/components/ui/CnicScanner'
import { type PassportData } from '@/components/ui/PassportScanner'
import { GuestScans } from '@/components/guests/GuestScans'
import { cn } from '@/lib/utils'
import type { ScannedImage } from '@/types'
import type { Guest } from '@/lib/guests'

/**
 * Create and edit a guest, including the card scan.
 *
 * Shared by the guest list and the profile board rather than living on either:
 * a profile that could be read but only edited from the list would send the
 * desk back and forth for a corrected CNIC digit.
 *
 * Laid out as a panel, not a single long scroll. The header names the record
 * and the footer keeps Save reachable, so only the fields move; scanning sits
 * in a side rail because it is an accelerator, not the record itself.
 */

export type GuestDraft = Omit<Guest, 'id' | '_count'>

export const EMPTY_GUEST: GuestDraft = {
  name: '', email: '', phone: '', cnic: '', fatherName: '', gender: '', address: '',
  province: '', district: '', passportNumber: '', nationality: '', passportExpiry: '', notes: '',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The guest to edit; omit to create a new one. */
  guest?: Guest | null
  onSaved?: (guest: Guest) => void
}

export function GuestFormDialog({ open, onOpenChange, guest, onSaved }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<GuestDraft>(EMPTY_GUEST)
  const [pendingScans, setPendingScans] = useState<ScannedImage[]>([])
  const [nameError, setNameError] = useState<string | null>(null)

  // Reset on open so a cancelled edit never leaks into the next one
  useEffect(() => {
    if (!open) return
    setForm(guest ? ({ ...EMPTY_GUEST, ...guest, _count: undefined } as GuestDraft) : EMPTY_GUEST)
    setPendingScans([])
    setNameError(null)
  }, [open, guest])

  const saveMutation = useMutation({
    mutationFn: async (payload: GuestDraft) => {
      const res = await fetch(guest ? `/api/guests/${guest.id}` : '/api/guests', {
        method: guest ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not save the guest')

      /* A new profile has no id until this returns, so scans wait in state and
         are filed here. The card image is the evidence behind a filing, and
         losing it because the guest was new would defeat keeping it at all. */
      const guestId = json.data?.id
      if (guestId && pendingScans.length > 0) {
        for (const scan of pendingScans) {
          const body = new FormData()
          body.append('file', scan.file)
          body.append('kind', scan.kind)
          await fetch(`/api/guests/${guestId}/documents`, { method: 'POST', body })
            .catch(() => toast.error(`Could not save the ${scan.label} image`))
        }
      }
      return json
    },
    onSuccess: (json) => {
      qc.invalidateQueries({ queryKey: ['guests'] })
      qc.invalidateQueries({ queryKey: ['guest'] })
      qc.invalidateQueries({ queryKey: ['guest-documents'] })
      toast.success(guest ? 'Guest updated' : 'Guest profile created')
      setPendingScans([])
      onOpenChange(false)
      onSaved?.(json.data)
    },
    onError: (e: Error) => toast.error(e.message),
  })

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
    setNameError(null)
    toast.success('CNIC read. Check the fields before saving.')
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
    setNameError(null)
    toast.success('Passport read. Check the fields before saving.')
  }

  /* Checked on blur and again on submit, and reported under the field rather
     than as a toast: a toast about a field you cannot see is not an error
     message, it is a riddle. */
  function validName() {
    const ok = (form.name || '').trim().length >= 2
    setNameError(ok ? null : 'Enter the guest name, at least two characters.')
    return ok
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!validName()) return
    saveMutation.mutate(form)
  }

  const set = (key: keyof GuestDraft, value: string) => setForm(f => ({ ...f, [key]: value }))

  const field = (
    key: keyof GuestDraft,
    label: string,
    opts: { placeholder?: string; type?: string; wide?: boolean } = {}
  ) => (
    <div className={cn('space-y-1.5', opts.wide && 'sm:col-span-2')}>
      <Label htmlFor={`guest-${key}`}>{label}</Label>
      <Input
        id={`guest-${key}`}
        type={opts.type}
        value={(form[key] as string) || ''}
        onChange={e => set(key, e.target.value)}
        placeholder={opts.placeholder}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader className="shrink-0 space-y-0.5 border-b px-6 py-4 pr-14">
            <DialogTitle className="text-base">
              {guest ? guest.name : 'New guest profile'}
            </DialogTitle>
            <DialogDescription>
              {guest
                ? 'Scanned once, reused on every stay this guest books.'
                : 'Scan a card or type the details. Both fill the same record.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            {/* One scroll on a phone, two independent columns on a desk */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">

              <div className="min-w-0 flex-1 space-y-5 px-6 py-5 md:overflow-y-auto md:scrollbar-thin">
                <Section title="Identity">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="guest-name">
                        Full name <span className="text-destructive" aria-hidden="true">*</span>
                      </Label>
                      <Input
                        id="guest-name"
                        value={form.name || ''}
                        onChange={e => { set('name', e.target.value); if (nameError) setNameError(null) }}
                        onBlur={validName}
                        placeholder="As printed on the card"
                        aria-required="true"
                        aria-invalid={!!nameError}
                        aria-describedby={nameError ? 'guest-name-error' : undefined}
                        className={cn(nameError && 'border-destructive focus-visible:border-destructive')}
                      />
                      {nameError && (
                        <p id="guest-name-error" className="text-xs text-destructive">{nameError}</p>
                      )}
                    </div>
                    {field('fatherName', "Father's name")}
                    {field('gender', 'Gender', { placeholder: 'Male or Female' })}
                    {field('cnic', 'CNIC', { placeholder: '12345-1234567-1', wide: true })}
                  </div>
                </Section>

                <Section title="Contact">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field('phone', 'Phone', { placeholder: '+92 300 0000000' })}
                    {field('email', 'Email', { type: 'email', placeholder: 'guest@email.com' })}
                  </div>
                </Section>

                <Section title="Address">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field('address', 'Address', { placeholder: 'House, street, area', wide: true })}
                    {field('province', 'Province')}
                    {field('district', 'District')}
                  </div>
                </Section>

                <Section title="Travel document">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field('passportNumber', 'Passport number', { wide: true })}
                    {field('nationality', 'Nationality')}
                    {field('passportExpiry', 'Passport expiry', { placeholder: 'YYYY-MM-DD' })}
                  </div>
                </Section>

                <Section title="Notes" last>
                  <textarea
                    id="guest-notes"
                    rows={3}
                    value={form.notes || ''}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Anything the desk should know next time."
                    className="flex w-full resize-y rounded-xl border border-input bg-black/[0.015] px-3.5 py-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.16)] dark:bg-white/[0.03]"
                  />
                </Section>
              </div>

              {/* Scanning is an accelerator, not the record, so it sits beside
                  the fields rather than on top of them. */}
              <aside className="shrink-0 border-t bg-muted/20 px-5 py-5 md:w-[290px] md:overflow-y-auto md:scrollbar-thin md:border-l md:border-t-0">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Identity documents
                </p>
                <GuestScans
                  guestId={guest?.id}
                  pending={pendingScans}
                  onCnic={applyCnic}
                  onPassport={applyPassport}
                  onDropPending={kind => setPendingScans(s => s.filter(x => x.kind !== kind))}
                />
              </aside>
            </div>

            <DialogFooter className="shrink-0 items-center gap-2 border-t px-6 py-4 sm:justify-between">
              <p className="hidden text-xs text-muted-foreground sm:block">
                {pendingScans.length > 0
                  ? `${pendingScans.length} scan${pendingScans.length === 1 ? '' : 's'} will be filed when you save.`
                  : 'A scan can be added at any time.'}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : guest ? 'Save changes' : 'Create profile'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A labelled group of fields, separated by a rule rather than boxed in a card. */
function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={cn('space-y-3', !last && 'border-b border-border/60 pb-5')}>
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}
