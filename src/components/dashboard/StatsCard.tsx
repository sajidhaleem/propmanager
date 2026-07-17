'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MagicCard } from '@/components/ui/magic-card'
import { NumberTicker } from '@/components/ui/number-ticker'

const configs = {
  blue:   {
    icon:   'bg-teal-500/15 text-teal-600 dark:text-teal-400',
    bar:    'from-teal-400 via-teal-500 to-teal-600',
    glow:   'rgba(27,165,142,0.10)',
    border: 'border-teal-100 dark:border-teal-900/40',
  },
  green:  {
    icon:   'bg-green-500/15 text-green-600 dark:text-green-400',
    bar:    'from-green-400 via-green-500 to-green-600',
    glow:   'rgba(34,197,94,0.10)',
    border: 'border-green-100 dark:border-green-900/40',
  },
  yellow: {
    icon:   'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    bar:    'from-amber-400 via-amber-500 to-orange-500',
    glow:   'rgba(245,158,11,0.10)',
    border: 'border-amber-100 dark:border-amber-900/40',
  },
  red:    {
    icon:   'bg-red-500/15 text-red-600 dark:text-red-400',
    bar:    'from-red-400 via-red-500 to-red-600',
    glow:   'rgba(239,68,68,0.10)',
    border: 'border-red-100 dark:border-red-900/40',
  },
  purple: {
    icon:   'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    bar:    'from-orange-400 via-orange-500 to-orange-600',
    glow:   'rgba(232,114,12,0.10)',
    border: 'border-orange-100 dark:border-orange-900/40',
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
