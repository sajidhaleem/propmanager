'use client'

import { ShieldAlert, ShieldX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { guestRiskStatus, type GuestRiskFields } from '@/lib/guestRisk'

/**
 * The flag, small enough to sit in a search result or beside a name.
 *
 * Renders nothing when there is no flag, which is the normal case — so it can
 * be dropped anywhere a guest appears without a surrounding conditional.
 *
 * Deliberately shows the level and nothing else. The reason and the note belong
 * where there is room to read them properly and to see who decided; a tooltip
 * full of grievance beside a name is how a private record turns into gossip.
 */
export function GuestRiskBadge({
  guest,
  className,
}: {
  guest?: GuestRiskFields | null
  className?: string
}) {
  const risk = guestRiskStatus(guest)
  if (!risk) return null

  const blocked = risk.level === 'DO_NOT_BOOK'
  const Icon = blocked ? ShieldX : ShieldAlert

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        blocked
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        // a lapsed flag is still shown, but not shouted
        risk.stale && 'opacity-70',
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {risk.label}
    </span>
  )
}
