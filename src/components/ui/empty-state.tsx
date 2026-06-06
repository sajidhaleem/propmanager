import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {/* Icon ring stack */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl scale-150" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/60 shadow-sm ring-8 ring-muted/20">
          <Icon className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
