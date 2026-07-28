'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, CalendarDays, BookOpen, Building2, Banknote,
  Receipt, Users, BarChart3, Settings, LogOut, Home, Search, Bell,
  Moon, Sun, ChevronDown, X, ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

// Sections that earn a permanent slot; the rest live in the "More" menu
const primaryNav = [
  { href: '/dashboard',          label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/calendar', label: 'Calendar',  icon: CalendarDays },
  { href: '/dashboard/bookings', label: 'Bookings',  icon: BookOpen },
  { href: '/dashboard/reports',  label: 'Reports',   icon: BarChart3 },
]

const moreNav = [
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/financials', label: 'Income',   icon: Banknote },
      { href: '/dashboard/expenses',   label: 'Expenses', icon: Receipt },
      { href: '/dashboard/payouts',    label: 'Payouts',  icon: Users },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/properties', label: 'Properties', icon: Building2 },
      { href: '/dashboard/settings',   label: 'Settings',   icon: Settings },
    ],
  },
]

const ALL_LINKS = [
  ...primaryNav.map(i => ({ ...i, category: 'Navigation' })),
  ...moreNav.flatMap(g => g.items.map(i => ({ ...i, category: g.label }))),
]

async function fetchNotifStats() {
  const res = await fetch('/api/dashboard/stats')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()

  const [moreOpen, setMoreOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [query, setQuery] = useState('')

  const moreRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { data: notifData } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchNotifStats,
    staleTime: 2 * 60 * 1000,
  })
  const stats = notifData?.data?.stats
  const recentBookings = notifData?.data?.recentBookings?.slice(0, 3) || []

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const moreIsActive = moreNav.some(g => g.items.some(i => isActive(i.href)))

  // Close any open menu on an outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false)
      if (userRef.current && !userRef.current.contains(t)) setUserOpen(false)
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'Escape') { setSearchOpen(false); setMoreOpen(false); setUserOpen(false); setNotifOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => { if (searchOpen) searchInputRef.current?.focus() }, [searchOpen])

  // Close menus when the route changes
  useEffect(() => { setMoreOpen(false); setUserOpen(false); setNotifOpen(false) }, [pathname])

  const filtered = query
    ? ALL_LINKS.filter(l => l.label.toLowerCase().includes(query.toLowerCase()))
    : ALL_LINKS

  function go(href: string) {
    setSearchOpen(false); setQuery('')
    router.push(href)
  }

  return (
    <>
      <header className="nav-pill sticky top-3 z-40 mx-3 flex h-14 items-center gap-2 px-2 sm:px-3">
        {/* Brand */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-white/5 transition-colors">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand shadow-lg shadow-primary/25">
            <Home className="h-4 w-4 text-white" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:block">PropManager</span>
        </Link>

        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="ml-1 hidden items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 h-9 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-border md:flex md:w-48 lg:w-56"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Search here…</span>
          <kbd className="ml-auto rounded border border-border/60 px-1 font-mono text-[10px]">⌘K</kbd>
        </button>

        {/* Primary nav */}
        <nav className="mx-auto hidden items-center gap-0.5 lg:flex">
          {primaryNav.map(item => {
            const Icon = item.icon
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors',
                  active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-gradient-brand shadow-lg shadow-primary/25"
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{item.label}</span>
              </Link>
            )
          })}

          {/* More menu */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(o => !o)}
              aria-expanded={moreOpen}
              className={cn(
                'flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors',
                moreIsActive || moreOpen ? 'text-foreground bg-white/5' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              More
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-panel depth-2 absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 overflow-hidden p-1.5"
                >
                  {moreNav.map(group => (
                    <div key={group.label} className="mb-1 last:mb-0">
                      <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                        {group.label}
                      </p>
                      {group.items.map(item => {
                        const Icon = item.icon
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                              active ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/80 hover:bg-white/5 hover:text-foreground'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {/* Search — small screens */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground md:hidden"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Theme */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(o => !o)}
              aria-label="Notifications"
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                notifOpen ? 'bg-white/5 text-foreground' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              )}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="glass-panel depth-2 absolute right-0 top-full mt-2 w-72 overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                    <p className="text-sm font-semibold">Activity</p>
                    <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-border/60">
                    <div className="bg-card px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</p>
                      <p className="mt-0.5 text-xl font-bold">{stats?.activeBookings ?? '—'}</p>
                    </div>
                    <div className="bg-card px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</p>
                      <p className="mt-0.5 text-xl font-bold text-amber-400">{stats?.pendingBookings ?? '—'}</p>
                    </div>
                  </div>
                  {recentBookings.length > 0 && (
                    <div className="py-1">
                      {recentBookings.map((b: any) => (
                        <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                            {b.guestName?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{b.guestName}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{b.property?.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-border/60 px-4 py-2.5">
                    <Link href="/dashboard/bookings" className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                      <BookOpen className="h-3 w-3" />
                      View all bookings
                      <ArrowUpRight className="ml-auto h-3 w-3" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen(o => !o)}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition-colors hover:bg-white/5 sm:pr-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[13px] font-medium">{user?.name || 'User'}</span>
                <span className="block text-[10px] text-muted-foreground">{user?.role || ''}</span>
              </span>
              <ChevronDown className={cn('hidden h-3.5 w-3.5 text-muted-foreground transition-transform sm:block', userOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {userOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="glass-panel depth-2 absolute right-0 top-full mt-2 w-48 overflow-hidden p-1.5"
                >
                  <Link href="/dashboard/settings" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-white/5 hover:text-foreground">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                  <button
                    onClick={() => logout()}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Command palette */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15 }}
              className="glass-panel depth-2 fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search pages and actions…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button onClick={() => setSearchOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results found</p>
                ) : (
                  Array.from(new Set(filtered.map(l => l.category))).map(cat => (
                    <div key={cat}>
                      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{cat}</p>
                      {filtered.filter(l => l.category === cat).map(link => {
                        const Icon = link.icon
                        return (
                          <button
                            key={link.href}
                            onClick={() => go(link.href)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {link.label}
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
