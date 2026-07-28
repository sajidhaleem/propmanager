import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/* Shared class for buttons, selects and toggles placed on the dark hero panel —
   the panel keeps its navy gradient in both themes, so controls inside it are
   always styled for a dark ground. */
export const HERO_CONTROL =
  'border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white ' +
  'focus-visible:ring-white/40 data-[placeholder]:text-white/60'

const TONE = {
  default: 'text-white',
  positive: 'text-emerald-300',
  negative: 'text-rose-300',
  warning: 'text-amber-300',
} as const

const METRIC_GRID: Record<number, string> = {
  1: 'grid-cols-1 sm:max-w-xs',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
}

export interface HeroMetric {
  label: string
  value: string | number
  hint?: string
  tone?: keyof typeof TONE
}

interface PageHeroProps {
  title: string
  description?: React.ReactNode
  /** Big lead number — the section's single most important figure. */
  headline?: { value: string; caption?: string; delta?: number }
  /** Inset pills below the headline. */
  metrics?: HeroMetric[]
  loading?: boolean
  /** Actions and filters, rendered top-right. Style them with HERO_CONTROL. */
  children?: React.ReactNode
  className?: string
}

export function PageHero({
  title,
  description,
  headline,
  metrics,
  loading = false,
  children,
  className,
}: PageHeroProps) {
  const compact = !headline && !metrics?.length

  return (
    <div
      className={cn(
        'bg-gradient-panel relative overflow-hidden rounded-[22px] border border-white/10',
        compact ? 'px-6 py-5 lg:px-7' : 'px-6 py-6 lg:px-8 lg:py-7',
        className
      )}
    >
      <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/25 blur-[90px]" />

      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-[1.6rem] font-semibold tracking-tight text-white">{title}</h1>
          {description && <p className="mt-1 text-sm text-white/60">{description}</p>}

          {headline && (
            <>
              {loading ? (
                <Skeleton className="mt-3 h-11 w-56 bg-white/10" />
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <span className="font-display text-4xl font-semibold tracking-tight text-white lg:text-[2.75rem]">
                    {headline.value}
                  </span>
                  {!!headline.delta && (
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                        headline.delta > 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'
                      )}
                    >
                      <TrendingUp className={cn('h-3 w-3', headline.delta < 0 && 'rotate-180')} />
                      {headline.delta > 0 ? '+' : ''}
                      {headline.delta}%
                    </span>
                  )}
                </div>
              )}
              {headline.caption && <p className="mt-1 text-xs text-white/45">{headline.caption}</p>}
            </>
          )}
        </div>

        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>

      {!!metrics?.length && (
        <div
          className={cn('relative mt-6 grid gap-3', METRIC_GRID[Math.min(metrics.length, 4)])}
        >
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm"
            >
              <p className="truncate text-[11px] font-medium text-white/60">{m.label}</p>
              {loading ? (
                <Skeleton className="mt-1.5 h-6 w-20 bg-white/10" />
              ) : (
                <p className={cn('mt-0.5 truncate text-lg font-semibold tabular-nums', TONE[m.tone ?? 'default'])}>
                  {m.value}
                </p>
              )}
              {m.hint && <p className="mt-0.5 truncate text-[10px] text-white/40">{m.hint}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
