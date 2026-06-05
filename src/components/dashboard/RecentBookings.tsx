'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, getStatusColor, getPlatformColor } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { Booking } from '@/types'

interface RecentBookingsProps {
  bookings: Booking[]
}

export function RecentBookings({ bookings }: RecentBookingsProps) {
  const { format } = useCurrency()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Bookings</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/bookings">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {bookings.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No bookings yet</p>
          )}
          {bookings.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{booking.guestName}</p>
                <p className="text-xs text-muted-foreground">
                  {booking.property?.name} · {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={getPlatformColor(booking.platform)} variant="outline">
                  {booking.platform === 'BOOKING_COM' ? 'BDC' : booking.platform}
                </Badge>
                <Badge className={getStatusColor(booking.status)} variant="outline">
                  {booking.status.replace('_', ' ')}
                </Badge>
                <span className="text-sm font-semibold tabular-nums">{format(booking.netAmount)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
