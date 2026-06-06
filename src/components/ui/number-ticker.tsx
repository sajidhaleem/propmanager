'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

interface NumberTickerProps {
  value: number
  /** Optional formatter — receives the animated float, return display string */
  format?: (v: number) => string
  className?: string
}

export function NumberTicker({ value, format, className }: NumberTickerProps) {
  const raw = useMotionValue(0)
  const spring = useSpring(raw, { damping: 50, stiffness: 80 })
  const display = useTransform(spring, (v) =>
    format ? format(v) : Math.round(v).toLocaleString()
  )

  useEffect(() => {
    raw.set(value)
  }, [raw, value])

  return (
    <motion.span className={cn('tabular-nums', className)}>
      {display}
    </motion.span>
  )
}
