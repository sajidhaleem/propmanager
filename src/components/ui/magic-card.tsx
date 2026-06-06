'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface MagicCardProps {
  children: React.ReactNode
  className?: string
  /** Spotlight colour — defaults to primary-blue tint */
  glowColor?: string
}

export function MagicCard({
  children,
  className,
  glowColor = 'rgba(59,130,246,0.10)',
}: MagicCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
  }, [])

  return (
    <div
      ref={ref}
      className={cn('relative', className)}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Spotlight overlay — sits on top of content, pointer-events disabled */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${pos.x}px ${pos.y}px, ${glowColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  )
}
