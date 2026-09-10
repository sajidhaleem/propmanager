'use client'

import Link from 'next/link'
import { ShieldAlert, ShieldX, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { guestRiskStatus, type GuestRiskFields } from '@/lib/guestRisk'

/**
 * The warning shown on a booking form once a flagged guest is linked.
 *
 * It states the position and gets out of the way. It does not disable Save and
 * it does not ask anyone to tick a box: the desk is being told something, and
 * what they do about it is the manager's call, not the form's. A hard block
 * here would only teach the desk to type the name slightly differently, which
 * would cost the property the record and the warning both.
 */
export function GuestRiskNotice({
  guest,
  guestId,
  className,
}: {
  guest?: GuestRiskFields | null
  guestId?: string | null
  className?: string
}) {
  const risk = guestRiskStatus(guest)
  if (!risk) return null

  const blocked = risk.level === 'DO_NOT_BOOK'
  const Icon = blocked ? ShieldX : ShieldAlert

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border p-3',
        blocked
          ? 'border-rose-500/40 bg-rose-500/[0.07]'
          : 'border-amber-500/40 bg-amber-500/[0.07]',
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', blocked ? 'text-rose-500' : 'text-amber-500')} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{risk.label} — {risk.desk}</p>
        <p className="mt-0.5 text-muted-foreground">{risk.reason}</p>
        {risk.note && <p className="mt-0.5 text-muted-foreground">“{risk.note}”</p>}
        {risk.stale && (
          <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            This flag is past its review date — it may no longer reflect the position.
          </p>
        )}
      </div>
      {guestId && (
        <Link
          href={`/dashboard/guests/${guestId}`}
          target="_blank"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Profile<ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}
