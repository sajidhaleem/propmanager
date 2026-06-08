import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function FinancialsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-40" /></div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-16" /></Card>)}
      </div>
      <Card className="p-6"><Skeleton className="h-72" /></Card>
      <Card className="p-0 overflow-hidden">
        <div className="divide-y">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-44" /><Skeleton className="h-3 w-28" /></div>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
