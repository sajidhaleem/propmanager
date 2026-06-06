'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, CalendarDays, BarChart3,
  Building2, Banknote, Receipt, Users, Settings,
  MoreHorizontal, X, LogOut, Home,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/ui'

// Primary tabs always visible in the bottom bar
const primaryTabs = [
  { href: '/dashboard',          label: 'Home',     icon: LayoutDashboard, exact: true },
  { href: '/dashboard/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/dashboard/reports',  label: 'Reports',  icon: BarChart3 },
]

// All nav groups shown in the "More" sheet
const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard',          label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/calendar', label: 'Calendar',  icon: CalendarDays },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/bookings',   label: 'Bookings',   icon: BookOpen },
      { href: '/dashboard/properties', label: 'Properties', icon: Building2 },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/financials', label: 'Income',   icon: Banknote },
      { href: '/dashboard/expenses',   label: 'Expenses', icon: Receipt },
      { href: '/dashboard/payouts',    label: 'Payouts',  icon: Users },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  ADMIN:   { label: 'Admin',   className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  MANAGER: { label: 'Manager', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  STAFF:   { label: 'Staff',   className: 'bg-green-500/20 text-green-400 border border-green-500/30' },
}

export function MobileNav() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { user, logout } = useAuth()
  const roleBadge = user?.role ? ROLE_BADGE[user.role] : ROLE_BADGE.STAFF

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Check if the current page is one of the "More" items (not in primary tabs)
  const primaryHrefs = primaryTabs.map(t => t.href)
  const moreIsActive = !primaryHrefs.some(href => {
    const tab = primaryTabs.find(t => t.href === href)
    return isActive(href, tab?.exact)
  })

  function handleNavClick() {
    setSheetOpen(false)
  }

  return (
    <>
      {/* ── Bottom tab bar ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex h-16 items-stretch border-t bg-background/95 backdrop-blur-md safe-bottom">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab.href, tab.exact)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
              <span>{tab.label}</span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setSheetOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
            moreIsActive ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <MoreHorizontal className={cn('h-5 w-5', moreIsActive ? 'text-primary' : 'text-muted-foreground')} />
          <span>More</span>
        </button>
      </nav>

      {/* ── More sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setSheetOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-sidebar border-t border-sidebar-border max-h-[85dvh]"
            >
              {/* Sheet handle + header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-sidebar-border shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary shadow-md">
                    <Home className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
                    PropManager
                  </span>
                </div>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-muted hover:text-sidebar-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nav groups — scrollable */}
              <div className="flex-1 overflow-y-auto py-3 px-3">
                {navGroups.map((group) => (
                  <div key={group.label} className="mb-4">
                    <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const active = isActive(item.href, item.exact)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={handleNavClick}
                            className={cn(
                              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
                              active
                                ? 'bg-sidebar-primary/15 text-sidebar-primary'
                                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                            )}
                          >
                            <Icon className={cn(
                              'h-[18px] w-[18px] shrink-0',
                              active ? 'text-sidebar-primary' : 'text-sidebar-foreground/50'
                            )} />
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* User footer */}
              <div className="border-t border-sidebar-border px-4 py-3 shrink-0 safe-bottom">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-blue-400 text-white text-sm font-bold shadow-sm">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-sidebar-foreground truncate">
                      {user?.name || 'User'}
                    </p>
                    <span className={cn('inline-block text-[10px] font-medium px-1.5 py-0 rounded mt-0.5', roleBadge.className)}>
                      {roleBadge.label}
                    </span>
                  </div>
                  <button
                    onClick={() => { setSheetOpen(false); logout() }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
