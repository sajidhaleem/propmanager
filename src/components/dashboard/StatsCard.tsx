'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const configs = {
  blue:   { icon: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400', bar: 'bg-blue-500', border: 'border-blue-100 dark:border-blue-900/40' },
  green:  { icon: 'bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400', bar: 'bg-green-500', border: 'border-green-100 dark:border-green-900/40' },
  yellow: { icon: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', bar: 'bg-amber-500', border: 'border-amber-100 dark:border-amber-900/40' },
  red:    { icon: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400', bar: 'bg-red-500', border: 'border-red-100 dark:border-red-900/40' },
  purple: { icon: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400', bar: 'bg-purple-500', border: 'border-purple-100 dark:border-purple-900/40' },
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

export function StatsCard({ title, value, subtitle, change, icon, color = 'blue', index = 0, footer }: StatsCardProps) {
  const cfg = configs[color]
  const isPositive = change !== undefined && change > 0
  const isNeutral = change === undefined || change === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: 'easeOut' }}
      className={cn('stat-card', cfg.border)}
    >
      {/* Top bar accent */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', cfg.bar)} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', cfg.icon)}>
          {icon}
        </div>
      </div>

      {(change !== undefined || footer) && (
        <div className="mt-4 flex items-center justify-between">
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {isNeutral ? (
                <Minus className="h-3 w-3 text-muted-foreground" />
              ) : isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={cn(
                'text-xs font-medium',
                isNeutral ? 'text-muted-foreground' : isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                {isNeutral ? 'No change' : `${isPositive ? '+' : ''}${change}%`}
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          )}
          {footer && <span className="text-xs text-muted-foreground">{footer}</span>}
        </div>
      )}
    </motion.div>
  )
}
