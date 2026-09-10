'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, ShieldX, ShieldCheck, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import {
  guestRiskStatus, defaultReviewDate,
  GUEST_RISK_LEVELS, GUEST_RISK_REASONS,
  type GuestRiskFields,
} from '@/lib/guestRisk'

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * The do-not-book record on a guest's profile: what it says, who decided, and
 * the controls to set or lift it.
 *
 * Lives on the profile rather than on a booking, because the decision is about
 * a person across every stay — and because setting it here forces whoever does
 * it to look at that person's actual history first.
 */
export function GuestRiskPanel({
  guestId,
  guest,
  canEdit,
}: {
  guestId: string
  guest: GuestRiskFields
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const risk = guestRiskStatus(guest)

  const [level, setLevel] = useState<string>(guest.riskLevel || 'CAUTION')
  const [reason, setReason] = useState<string>(guest.riskReason || '')
  const [note, setNote] = useState<string>(guest.riskNote || '')
  const [reviewAt, setReviewAt] = useState<string>(
    guest.riskReviewAt ? iso(new Date(guest.riskReviewAt)) : iso(defaultReviewDate()),
  )

  const save = useMutation({
    mutationFn: async (body: unknown) => {
      const res = await fetch(`/api/guests/${guestId}/risk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not save')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest', guestId] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit() {
    save.mutate(
      { riskLevel: level, riskReason: reason || null, riskNote: note, riskReviewAt: reviewAt || null },
      { onSuccess: () => toast.success('Flag saved') },
    )
  }

  function lift() {
    if (!confirm('Lift this flag? The change is recorded against your name.')) return
    save.mutate({ riskLevel: null }, { onSuccess: () => toast.success('Flag lifted') })
  }

  const blocked = risk?.level === 'DO_NOT_BOOK'
  const Icon = !risk ? ShieldCheck : blocked ? ShieldX : ShieldAlert

  return (
    <>
      <div
        className={cn(
          'rounded-xl border p-4',
          !risk && 'border-border/60 bg-muted/20',
          risk && !blocked && 'border-amber-500/40 bg-amber-500/[0.07]',
          blocked && 'border-rose-500/40 bg-rose-500/[0.07]',
        )}
      >
        <div className="flex items-start gap-3">
          <Icon
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0',
              !risk && 'text-muted-foreground',
              risk && !blocked && 'text-amber-500',
              blocked && 'text-rose-500',
            )}
          />
          <div className="min-w-0 flex-1">
            {risk ? (
              <>
                <p className="text-sm font-semibold">{risk.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{risk.desk}</p>
                <p className="mt-2 text-sm">{risk.reason}</p>
                {risk.note && (
                  <p className="mt-1 text-sm text-muted-foreground">“{risk.note}”</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {risk.setBy ? `Set by ${risk.setBy}` : 'Set by someone no longer recorded'}
                  {risk.setAt && ` · ${formatDate(risk.setAt, 'd MMM yyyy')}`}
                </p>
                {risk.reviewAt && (
                  <p className={cn('mt-1 flex items-center gap-1 text-xs',
                    risk.stale ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                    <Clock className="h-3 w-3" />
                    {risk.stale
                      ? `Due for review since ${formatDate(risk.reviewAt, 'd MMM yyyy')} — renew it or lift it`
                      : `Review by ${formatDate(risk.reviewAt, 'd MMM yyyy')}`}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">No flag</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  This guest books like any other.
                </p>
              </>
            )}
          </div>

          {canEdit && (
            <div className="flex shrink-0 flex-col gap-1.5">
              <Button size="sm" variant={risk ? 'outline' : 'secondary'} onClick={() => setOpen(true)}>
                {risk ? 'Edit' : 'Add flag'}
              </Button>
              {risk && (
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={lift}>
                  Lift
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{risk ? 'Edit flag' : 'Flag this guest'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>What should the desk do?</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GUEST_RISK_LEVELS.map(l => (
                    <SelectItem key={l.key} value={l.key}>{l.label} — {l.desk}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>What happened?</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Pick what happened" /></SelectTrigger>
                <SelectContent>
                  {GUEST_RISK_REASONS.map(r => (
                    <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="risk-note">Note</Label>
              {/* Same styling as the guest notes field — there is no Textarea
                  component in this project and one field does not earn one */}
              <textarea
                id="risk-note"
                value={note}
                maxLength={280}
                rows={3}
                onChange={e => setNote(e.target.value)}
                placeholder="What they did, in a sentence. Room 3, 14 March: left with Rs 12,000 unpaid."
                className="flex w-full resize-y rounded-xl border border-input bg-black/[0.015] px-3.5 py-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.16)] dark:bg-white/[0.03]"
              />
              {/* Said at the point of typing, because this is the field that
                  causes trouble later. */}
              <p className="text-xs text-muted-foreground">
                Describe what the guest <strong>did</strong>, not what they are. Never record
                religion, sect, ethnicity, nationality, marital status or appearance. Assume the
                guest will one day read this back to you.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="risk-review">Review by</Label>
              <Input id="risk-review" type="date" value={reviewAt}
                onChange={e => setReviewAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                A flag is not a life sentence. On this date it is shown as needing a fresh decision.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save flag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
