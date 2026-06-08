import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[88px] w-full rounded-2xl" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Card key={i} className="p-6"><Skeleton className="h-20" /></Card>)}
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => <Card key={i} className="p-6"><Skeleton className="h-16" /></Card>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6"><Skeleton className="h-72" /></Card>
        <Card className="p-6"><Skeleton className="h-72" /></Card>
      </div>
      <Card className="p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </Card>
    </div>
  )
}
