'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MagicCard } from '@/components/ui/magic-card'
import { NumberTicker } from '@/components/ui/number-ticker'

const configs = {
  blue:   {
    icon:   'bg-blue-500/15 text-blue-600 dark:text-blue-300',
    bar:    'from-blue-400 via-blue-500 to-blue-600',
    glow:   'rgba(59,130,246,0.18)',
    border: 'border-blue-100 dark:border-blue-400/20',
  },
  violet: {
    icon:   'bg-violet-500/15 text-violet-600 dark:text-violet-300',
    bar:    'from-violet-400 via-violet-500 to-violet-600',
    glow:   'rgba(139,92,246,0.16)',
    border: 'border-violet-100 dark:border-violet-400/20',
  },
  /* Reserved for spend — the one place a warm hue is semantic, not decorative */
  red:    {
    icon:   'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    bar:    'from-rose-400 via-rose-500 to-rose-600',
    glow:   'rgba(244,63,94,0.14)',
    border: 'border-rose-100 dark:border-rose-400/20',
  },
  cyan:   {
    icon:   'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
    bar:    'from-cyan-400 via-cyan-500 to-cyan-600',
    glow:   'rgba(34,211,238,0.16)',
    border: 'border-cyan-100 dark:border-cyan-400/20',
  },
}

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: number
  icon: React.ReactNode
  color?: keyof typeof configs
  index?: number
  footer?: string
}

export function StatsCard({
  title, value, subtitle, change, icon,
  color = 'blue', index = 0, footer,
}: StatsCardProps) {
  const cfg = configs[color]
  const isPositive = change !== undefined && change > 0
  const isNeutral  = change === undefined || change === 0
  const isNumeric  = typeof value === 'number'
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.35, delay: shouldReduceMotion ? 0 : index * 0.07, ease: 'easeOut' }}
    >
      <MagicCard
        glowColor={cfg.glow}
        className={cn('stat-card', cfg.border)}
      >
        {/* Gradient top bar */}
        <div className={cn('absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r', cfg.bar)} />

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            <p className="font-display mt-2 text-2xl font-semibold tracking-tight">
              {isNumeric
                ? <NumberTicker value={value as number} />
                : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* Icon badge */}
          <div className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5',
            cfg.icon
          )}>
            {icon}
          </div>
        </div>

        {(change !== undefined || footer) && (
          <div className="mt-4 flex items-center justify-between">
            {change !== undefined && (
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  isNeutral
                    ? 'bg-muted text-muted-foreground'
                    : isPositive
                      ? 'bg-green-500/12 text-green-600 dark:text-green-400'
                      : 'bg-red-500/12 text-red-600 dark:text-red-400'
                )}>
                  {isNeutral
                    ? <Minus className="h-3 w-3" />
                    : isPositive
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />}
                  {isNeutral ? 'No change' : `${isPositive ? '+' : ''}${change}%`}
                </div>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            )}
            {footer && <span className="text-xs text-muted-foreground">{footer}</span>}
          </div>
        )}
      </MagicCard>
    </motion.div>
  )
}
