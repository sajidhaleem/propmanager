import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5"><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-56" /></div>
      <div className="flex gap-3"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-36" /></div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-16" /></Card>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><Skeleton className="h-64" /></Card>
        <Card className="p-6"><Skeleton className="h-64" /></Card>
      </div>
    </div>
  )
}
