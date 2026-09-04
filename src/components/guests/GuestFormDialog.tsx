'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CnicScanner, type CnicData } from '@/components/ui/CnicScanner'
import { PassportScanner, type PassportData } from '@/components/ui/PassportScanner'
import type { ScannedImage } from '@/types'
import type { Guest } from '@/lib/guests'

/**
 * Create and edit a guest, including the card scan.
 *
 * Shared by the guest list and the profile board rather than living on either:
 * a profile that could be read but only edited from the list would send the
 * desk back and forth for a corrected CNIC digit.
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

  // Reset on open so a cancelled edit never leaks into the next one
  useEffect(() => {
    if (!open) return
    setForm(guest ? ({ ...EMPTY_GUEST, ...guest, _count: undefined } as GuestDraft) : EMPTY_GUEST)
    setPendingScans([])
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
    onSuccess: (json) => {
      qc.invalidateQueries({ queryKey: ['guests'] })
      qc.invalidateQueries({ queryKey: ['guest'] })
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
    if ((form.name || '').trim().length < 2) { toast.error('Enter the guest name'); return }
    saveMutation.mutate(form)
  }

  const field = (key: keyof GuestDraft, label: string, placeholder = '') => (
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{guest ? `Edit ${guest.name}` : 'New guest profile'}</DialogTitle>
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
          <div>{field('address', 'Address')}</div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : guest ? 'Save changes' : 'Create profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
