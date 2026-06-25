'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Label } from 'recharts'

const COLORS = ['#FF5A5F', '#3b82f6', '#6366f1', '#f59e0b', '#6b7280']
const PLATFORM_LABELS: Record<string, string> = {
  AIRBNB: 'Airbnb',
  DIRECT: 'Direct',
  BOOKING_COM: 'Booking.com',
  VRBO: 'VRBO',
  OTHER: 'Other',
}

interface PlatformChartProps {
  data: Array<{ platform: string; _count: { id: number }; _sum: { netAmount: number | null } }>
}

export function PlatformChart({ data }: PlatformChartProps) {
  const chartData = data.map((d, i) => ({
    name: PLATFORM_LABELS[d.platform] || d.platform,
    value: d._count.id,
    revenue: d._sum.netAmount || 0,
    color: COLORS[i % COLORS.length],
  }))

  const totalBookings = chartData.reduce((s, d) => s + d.value, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings by Platform</CardTitle>
        <CardDescription>Distribution of bookings across platforms</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={3}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
              <Label
                content={({ viewBox }) => {
                  const { cx, cy } = viewBox as { cx: number; cy: number }
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={56} fill="hsl(var(--card))" />
                      <text x={cx} y={cy - 5} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: 'hsl(var(--foreground))' }}>
                        {totalBookings}
                      </text>
                      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}>
                        bookings
                      </text>
                    </g>
                  )
                }}
                position="center"
              />
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
