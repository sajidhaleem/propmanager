'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, CalendarDays, BookOpen, Building2, Banknote,
  Receipt, Users, BarChart3, Settings, LogOut, Home, Search,
  Moon, Sun, ChevronDown, X, ShieldCheck, UserSquare2,
  PanelLeftClose, PanelLeftOpen, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

type NavItem = {
  href: string
  label: string
  icon: typeof Home
  exact?: boolean
  feature?: string
  items?: { href: string; label: string; icon: typeof Home }[]
}

/**
 * One flat list instead of "primary" and "More": a sidebar has the room the top
 * bar did not, so nothing needs hiding behind an overflow menu.
 */
const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true, feature: 'dashboard' },
      { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays, feature: 'calendar' },
      {
        href: '/dashboard/bookings',
        label: 'Bookings',
        icon: BookOpen,
        feature: 'bookings',
        items: [
          { href: '/dashboard/bookings?view=hoteleye', label: 'Hotel Eye', icon: ShieldCheck },
          { href: '/dashboard/bookings?view=all', label: 'All', icon: BookOpen },
        ],
      },
      { href: '/dashboard/guests', label: 'Guests', icon: UserSquare2, feature: 'guests' },
      { href: '/dashboard/properties', label: 'Properties', icon: Building2, feature: 'properties' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/financials', label: 'Income', icon: Banknote, feature: 'income' },
      { href: '/dashboard/expenses', label: 'Expenses', icon: Receipt, feature: 'expenses' },
      { href: '/dashboard/payouts', label: 'Payouts', icon: Users, feature: 'payouts' },
      { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, feature: 'reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/settings', label: 'Settings', icon: Settings, feature: 'settings' },
    ],
  },
]

const ALL_LINKS = NAV.flatMap(g =>
  g.items.flatMap(i =>
    i.items
      ? i.items.map(s => ({ ...s, feature: i.feature, category: g.label }))
      : [{ href: i.href, label: i.label, icon: i.icon, feature: i.feature, category: g.label }]
  )
)

const COLLAPSE_KEY = 'propmanager.sidenav.collapsed'

export function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()

  const [collapsed, setCollapsed] = useState(false)
  // Collapsed by default — the two views are switchable from the page title,
  // so the sub-menu is a shortcut rather than the way in
  const [bookingsOpen, setBookingsOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const userRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Remembered per browser; a preference, so a failed read is not worth handling loudly
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1') } catch { /* private mode */ }
  }, [])
  function toggleCollapsed() {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* private mode */ }
      return !c
    })
  }

  /* The filing position, refreshed on the same cadence as the bookings page.
     This is the reason the sidebar exists rather than a row of links. */
  const { data: complianceData } = useQuery({
    queryKey: ['hotel-eye', 'compliance'],
    queryFn: async () => {
      const res = await fetch('/api/hotel-eye/compliance')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 5 * 60 * 1000,
  })
  const compliance = complianceData?.data

  function isActive(href: string, exact = false) {
    const path = href.split('?')[0]
    if (exact) return pathname === path
    return pathname === path || pathname.startsWith(path + '/')
  }

  /* Before /api/auth/me answers we show everything rather than flash an empty
     sidebar. Nothing is protected by this — every route checks for itself. */
  const allowed: string[] | undefined = user?.permissions
  const has = (feature?: string) => !feature || !allowed || allowed.includes(feature)

  const groups = NAV
    .map(g => ({ ...g, items: g.items.filter(i => has(i.feature)) }))
    .filter(g => g.items.length > 0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'Escape') { setSearchOpen(false); setUserOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => { if (searchOpen) searchInputRef.current?.focus() }, [searchOpen])
  useEffect(() => { setUserOpen(false) }, [pathname])

  const searchable = ALL_LINKS.filter(l => has(l.feature))
  const filtered = query
    ? searchable.filter(l => l.label.toLowerCase().includes(query.toLowerCase()))
    : searchable

  function go(href: string) {
    setSearchOpen(false); setQuery('')
    router.push(href)
  }

  const showLabels = !collapsed

  return (
    <>
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border/60 bg-background/40 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        {/* Brand */}
        <div className={cn('flex h-14 items-center gap-2 px-3', collapsed && 'justify-center px-0')}>
          <Link href="/dashboard" className="flex items-center gap-2 rounded-full py-1 hover:opacity-90">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand shadow-lg shadow-primary/25">
              <Home className="h-4 w-4 text-white" />
            </span>
            {showLabels && <span className="text-sm font-semibold tracking-tight">PropManager</span>}
          </Link>
        </div>

        {/* Search */}
        <div className={cn('px-3 pb-2', collapsed && 'px-2')}>
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background/40 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground',
              collapsed ? 'w-full justify-center' : 'w-full px-2.5'
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            {showLabels && (
              <>
                <span className="truncate">Search…</span>
                <kbd className="ml-auto rounded border border-border/60 px-1 font-mono text-[10px]">⌘K</kbd>
              </>
            )}
          </button>
        </div>

        {/* Sections */}
        <nav className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-3 py-2">
          {groups.map(group => (
            <div key={group.label} className="space-y-0.5">
              {showLabels && (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              {group.items.map(item => {
                const Icon = item.icon
                const active = isActive(item.href, item.exact)

                if (item.items && showLabels) {
                  return (
                    <div key={item.href}>
                      <button
                        onClick={() => setBookingsOpen(o => !o)}
                        aria-expanded={bookingsOpen}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          active ? 'bg-primary/15 font-medium text-primary' : 'text-foreground/80 hover:bg-white/5 hover:text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                        <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition-transform', bookingsOpen && 'rotate-180')} />
                      </button>
                      {bookingsOpen && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/60 pl-2">
                          {item.items.map(sub => (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-foreground/70 transition-colors hover:bg-white/5 hover:text-foreground"
                            >
                              <sub.icon className="h-3.5 w-3.5 shrink-0" />
                              {sub.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors',
                      collapsed ? 'justify-center px-0' : 'px-2.5',
                      active ? 'bg-primary/15 font-medium text-primary' : 'text-foreground/80 hover:bg-white/5 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {showLabels && item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Tonight's filing position — the nav says what needs doing, not just where things are */}
        {compliance && has('bookings') && (
          <ComplianceCard compliance={compliance} collapsed={collapsed} />
        )}

        {/* Footer */}
        <div className={cn('flex items-center gap-1 border-t border-border/60 p-2', collapsed && 'flex-col')}>
          <div className="relative min-w-0 flex-1" ref={userRef}>
            <button
              onClick={() => setUserOpen(o => !o)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-white/5',
                collapsed && 'justify-center'
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </span>
              {showLabels && (
                <span className="min-w-0 flex-1 text-left leading-tight">
                  <span className="block truncate text-[13px] font-medium">{user?.name || 'User'}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{user?.role || ''}</span>
                </span>
              )}
            </button>
            <AnimatePresence>
              {userOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="glass-panel depth-2 absolute bottom-full left-0 mb-2 w-48 overflow-hidden p-1.5"
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

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </button>

          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </aside>

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

type Compliance = { arrivalsToday: number; filedToday: number; overdue: number; failed: number; clear: boolean }

/**
 * Reads the same numbers as the bookings day banner. Severity is by exposure:
 * anything past 24 hours outranks a clean day, because that is the one an
 * inspector would find.
 */
function ComplianceCard({ compliance, collapsed }: { compliance: Compliance; collapsed: boolean }) {
  const { arrivalsToday, filedToday, overdue, failed } = compliance
  const needsAttention = overdue > 0 || failed > 0
  const href = needsAttention
    ? '/dashboard/bookings?view=hoteleye&filter=OVERDUE'
    : '/dashboard/bookings?view=hoteleye'

  if (collapsed) {
    return (
      <Link
        href={href}
        title={needsAttention ? `${overdue} overdue, ${failed} failed` : `${filedToday}/${arrivalsToday} filed today`}
        className={cn(
          'mx-2 mb-2 flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[11px] font-semibold tabular-nums transition-colors',
          needsAttention
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
            : 'border-border/60 text-muted-foreground hover:bg-white/5'
        )}
      >
        {needsAttention
          ? <><AlertTriangle className="h-3.5 w-3.5" />{overdue + failed}</>
          : <><CheckCircle2 className="h-3.5 w-3.5" />{filedToday}/{arrivalsToday}</>}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'mx-3 mb-2 block rounded-xl border p-3 transition-colors',
        needsAttention
          ? 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/15'
          : 'border-border/60 bg-background/40 hover:bg-white/5'
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {needsAttention
          ? <AlertTriangle className="h-3 w-3 text-rose-500" />
          : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
        Hotel Eye tonight
      </p>
      <p className="mt-1.5 text-lg font-bold tabular-nums">
        {filedToday} / {arrivalsToday}
        <span className="ml-1.5 text-xs font-medium text-muted-foreground">filed</span>
      </p>
      {needsAttention ? (
        <p className="mt-0.5 text-xs font-medium text-rose-500">
          {overdue > 0 && `${overdue} past 24h`}
          {overdue > 0 && failed > 0 && ' · '}
          {failed > 0 && `${failed} failed`}
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {arrivalsToday === 0 ? 'No arrivals today' : 'Nothing overdue'}
        </p>
      )}
    </Link>
  )
}
