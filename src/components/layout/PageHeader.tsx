import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 flex-wrap', className)}>
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
