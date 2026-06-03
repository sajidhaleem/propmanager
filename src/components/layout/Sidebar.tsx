'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CalendarDays, BookOpen, Building2, DollarSign,
  Receipt, Users, BarChart3, Settings, LogOut, Home, ChevronLeft,
  Wifi, WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/bookings', label: 'Bookings', icon: BookOpen },
      { href: '/dashboard/properties', label: 'Properties', icon: Building2 },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/financials', label: 'Income', icon: DollarSign },
      { href: '/dashboard/expenses', label: 'Expenses', icon: Receipt },
      { href: '/dashboard/payouts', label: 'Payouts', icon: Users },
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
  ADMIN:   { label: 'Admin',   className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  MANAGER: { label: 'Manager', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  STAFF:   { label: 'Staff',   className: 'bg-green-500/20 text-green-400 border-green-500/30' },
}

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore()
  const { user, logout } = useAuth()
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const roleBadge = user?.role ? ROLE_BADGE[user.role] : ROLE_BADGE.STAFF

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col
                   bg-sidebar border-r border-sidebar-border
                   lg:relative lg:translate-x-0 lg:flex"
        style={{ x: undefined }}
      >
        {/* ── Logo ── */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary shadow-md">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
              PropManager
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
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
                      onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false) }}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                        active
                          ? 'nav-active'
                          : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                      )}
                    >
                      <Icon className={cn(
                        'h-[15px] w-[15px] shrink-0 transition-colors',
                        active ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground'
                      )} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Offline indicator ── */}
        {!isOnline && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
            <WifiOff className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-300">Working offline</p>
          </div>
        )}

        {/* ── User ── */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-sidebar-accent transition-colors">
            <div className="relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-blue-400 text-white text-xs font-bold shadow-sm shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className={cn(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar',
                isOnline ? 'bg-green-500' : 'bg-gray-400'
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate leading-tight">
                {user?.name || 'User'}
              </p>
              <span className={cn(
                'inline-block text-[10px] font-medium px-1.5 py-0 rounded border mt-0.5',
                roleBadge.className
              )}>
                {roleBadge.label}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sidebar-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  )
}
