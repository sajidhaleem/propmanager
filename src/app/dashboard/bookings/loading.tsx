import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function BookingsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Skeleton className="h-7 w-32" /><Skeleton className="h-4 w-28" /></div>
        <div className="flex gap-2"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-32" /></div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 min-w-[200px]" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
      </div>
      <div className="space-y-6">
        {[...Array(2)].map((_, g) => (
          <div key={g} className="space-y-2">
            <Skeleton className="h-6 w-40 rounded-full" />
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-60" /></div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
