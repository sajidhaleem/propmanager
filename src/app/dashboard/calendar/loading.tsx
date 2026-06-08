import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Skeleton className="h-7 w-28" /><Skeleton className="h-4 w-40" /></div>
        <div className="flex gap-2"><Skeleton className="h-9 w-9" /><Skeleton className="h-9 w-36" /><Skeleton className="h-9 w-9" /></div>
      </div>
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-7 gap-1">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-6" />)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </Card>
    </div>
  )
}
