'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import { format, parse } from 'date-fns'
import { useCurrency } from '@/hooks/useCurrency'
import { TrendingUp, TrendingDown, Minus, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RevenueChartProps {
  data: Array<{ month: string; revenue: number; expenses?: number }>
}

function formatMonth(monthStr: string) {
  try {
    return format(parse(monthStr, 'yyyy-MM', new Date()), 'MMM yy')
  } catch {
    return monthStr
  }
}

const CustomTooltip = ({ active, payload, label, formatMoney }: any) => {
  if (!active || !payload?.length) return null
  const revenue  = payload.find((p: any) => p.dataKey === 'revenue')?.value  ?? 0
  const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value ?? 0
  const net = revenue - expenses
  return (
    <div className="rounded-xl border bg-card shadow-lg px-4 py-3 text-sm min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />Revenue
          </span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{formatMoney(revenue)}</span>
        </div>
        {expenses > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />Expenses
            </span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">{formatMoney(expenses)}</span>
          </div>
        )}
        <div className="border-t pt-1.5 flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Net</span>
          <span className={cn('font-bold', net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400')}>
            {net >= 0 ? '+' : ''}{formatMoney(net)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function RevenueChart({ data }: RevenueChartProps) {
  const { format: formatMoney } = useCurrency()
  const chartData = data.map((d) => ({ ...d, month: formatMonth(d.month) }))

  const totalRevenue  = data.reduce((s, d) => s + (d.revenue  || 0), 0)
  const totalExpenses = data.reduce((s, d) => s + (d.expenses || 0), 0)
  const netProfit     = totalRevenue - totalExpenses
  const hasExpenses   = chartData.some((d) => (d.expenses ?? 0) > 0)

  const summaryItems = [
    {
      label: 'Total Revenue',
      value: formatMoney(totalRevenue),
      icon: DollarSign,
      color: 'text-blue-600 dark:text-blue-400',
      bg:    'bg-blue-500/10',
    },
    {
      label: 'Total Expenses',
      value: formatMoney(totalExpenses),
      icon: TrendingDown,
      color: 'text-rose-600 dark:text-rose-400',
      bg:    'bg-rose-500/10',
    },
    {
      label: 'Net Profit',
      value: formatMoney(netProfit),
      icon: netProfit >= 0 ? TrendingUp : TrendingDown,
      color: netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400',
      bg:    netProfit >= 0 ? 'bg-green-500/10' : 'bg-rose-500/10',
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">Revenue Overview</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Monthly revenue vs expenses</p>
          </div>
          {/* Summary pills */}
          <div className="flex flex-wrap gap-2">
            {summaryItems.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5', item.bg)}>
                  <Icon className={cn('h-3.5 w-3.5', item.color)} />
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{item.label}</p>
                    <p className={cn('text-xs font-bold leading-none', item.color)}>{item.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-2">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
            No revenue data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 'auto']}
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                  if (v >= 1_000) return `${Math.round(v / 1_000)}K`
                  return String(v)
                }}
                width={40}
              />
              <Tooltip
                content={<CustomTooltip formatMoney={formatMoney} />}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5, radius: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(value) => (
                  <span className="text-muted-foreground capitalize">{value}</span>
                )}
              />
              <Bar dataKey="revenue" name="Revenue" fill="#d96708" radius={[4, 4, 0, 0]} maxBarSize={40} />
              {hasExpenses && (
                <Bar dataKey="expenses" name="Expenses" fill="#e5484d" radius={[4, 4, 0, 0]} maxBarSize={40} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
