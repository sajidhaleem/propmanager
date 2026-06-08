import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5"><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-48" /></div>
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="space-y-1"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-52" /></div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
