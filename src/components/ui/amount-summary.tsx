import { cn } from '@/lib/utils'

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-right font-medium', cls)}>{value}</span>
    </div>
  )
}

/**
 * Total / Paid / Remaining mini-summary, matching the Booking form's
 * Total/Paid/Outstanding pattern (src/app/dashboard/bookings/page.tsx).
 */
export function AmountSummary({
  total, paid, format,
}: { total: number; paid: number; format: (n: number) => string }) {
  const remaining = Math.max(0, total - paid)
  return (
    <div className="col-span-2 space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3">
      <Row label="Total" value={format(total)} />
      <Row label="Paid" value={format(paid)} />
      {remaining > 0
        ? <Row label="Remaining" value={format(remaining)} cls="text-amber-500 font-semibold" />
        : <Row label="Remaining" value="Fully paid ✓" cls="text-green-600 font-semibold" />}
    </div>
  )
}
