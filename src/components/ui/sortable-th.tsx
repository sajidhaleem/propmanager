'use client'

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortableThProps {
  label: string
  field: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSort: (field: string) => void
  align?: 'left' | 'right'
  className?: string
}

export function SortableTh({
  label, field, sortBy, sortOrder, onSort, align = 'left', className,
}: SortableThProps) {
  const active = sortBy === field
  return (
    <th
      onClick={() => onSort(field)}
      className={cn(
        'px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap',
        'hover:text-foreground transition-colors',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {label}
        {active
          ? sortOrder === 'asc'
            ? <ChevronUp   className="h-3.5 w-3.5 text-primary shrink-0" />
            : <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
          : <ChevronsUpDown className="h-3 w-3 opacity-30 shrink-0" />
        }
      </span>
    </th>
  )
}
