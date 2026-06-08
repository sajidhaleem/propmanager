import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function PropertiesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Skeleton className="h-7 w-36" /><Skeleton className="h-4 w-28" /></div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5"><Skeleton className="h-5 w-40" /><Skeleton className="h-3.5 w-28" /></div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-12 rounded-lg" />)}
            </div>
            <Skeleton className="h-8 w-full rounded-lg" />
          </Card>
        ))}
      </div>
    </div>
  )
}
