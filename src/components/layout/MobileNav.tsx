'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, CalendarDays, BarChart3, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/dashboard/expenses', label: 'Expenses', icon: Receipt },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
]

export function MobileNav() {
  const pathname = usePathname()

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="mobile-nav">
      {items.map((item) => {
        const Icon = item.icon
        const active = isActive(item.href, item.exact)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('mobile-nav-item', active && 'active')}
          >
            <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
            <span className={cn(active ? 'text-primary' : 'text-muted-foreground')}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
