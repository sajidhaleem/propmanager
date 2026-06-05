'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { format, parse } from 'date-fns'
import { useCurrency } from '@/hooks/useCurrency'

interface RevenueChartProps {
  data: Array<{ month: string; revenue: number; expenses?: number }>
}

function formatMonth(monthStr: string) {
  try {
    return format(parse(monthStr, 'yyyy-MM', new Date()), 'MMM')
  } catch {
    return monthStr
  }
}

export function RevenueChart({ data }: RevenueChartProps) {
  const { format: formatMoney } = useCurrency()
  const chartData = data.map((d) => ({
    ...d,
    month: formatMonth(d.month),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Overview</CardTitle>
        <CardDescription>Monthly revenue vs expenses</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoney(v)} />
            <Tooltip
              formatter={(value: number) => [formatMoney(value), '']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revenue)" strokeWidth={2} />
            {chartData.some((d) => d.expenses !== undefined) && (
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" fill="url(#expenses)" strokeWidth={2} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
