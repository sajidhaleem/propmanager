'use client'

import { Menu, Moon, Sun, Bell, Search, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/bookings': 'Bookings',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/properties': 'Properties',
  '/dashboard/financials': 'Income',
  '/dashboard/expenses': 'Expenses',
  '/dashboard/payouts': 'Payouts',
  '/dashboard/reports': 'Reports',
  '/dashboard/settings': 'Settings',
}

const QUICK_LINKS = [
  { label: 'Dashboard', href: '/dashboard', category: 'Navigation' },
  { label: 'New Booking', href: '/dashboard/bookings', category: 'Actions' },
  { label: 'Calendar', href: '/dashboard/calendar', category: 'Navigation' },
  { label: 'Income Report', href: '/dashboard/financials', category: 'Finance' },
  { label: 'Add Expense', href: '/dashboard/expenses', category: 'Finance' },
  { label: 'Payouts', href: '/dashboard/payouts', category: 'Finance' },
  { label: 'Reports', href: '/dashboard/reports', category: 'Reports' },
  { label: 'Settings', href: '/dashboard/settings', category: 'System' },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { toggleSidebar } = useUIStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const title = PAGE_TITLES[pathname] || 'PropManager'

  const filtered = query.length > 0
    ? QUICK_LINKS.filter(l => l.label.toLowerCase().includes(query.toLowerCase()))
    : QUICK_LINKS

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function navigate(href: string) {
    setSearchOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 backdrop-blur-sm px-4 safe-top">
        {/* Menu toggle — desktop only (mobile uses bottom nav) */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Page title */}
        <h1 className="text-sm font-semibold text-foreground hidden sm:block">{title}</h1>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg border bg-muted/50 text-muted-foreground text-xs hover:bg-muted hover:text-foreground transition-colors min-w-[180px]"
        >
          <Search className="h-3 w-3" />
          <span>Quick search…</span>
          <kbd className="ml-auto font-mono text-[10px] bg-background border rounded px-1">⌘K</kbd>
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>

        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 ring-1 ring-background" />
        </button>
      </header>

      {/* Command palette */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border bg-card shadow-xl overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search pages and actions…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button onClick={() => setSearchOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-72 overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results found</p>
                ) : (
                  <>
                    {Array.from(new Set(filtered.map(l => l.category))).map(cat => (
                      <div key={cat}>
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                          {cat}
                        </p>
                        {filtered.filter(l => l.category === cat).map(link => (
                          <button
                            key={link.href}
                            onClick={() => navigate(link.href)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                          >
                            <span className="flex-1">{link.label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="border-t px-4 py-2 flex items-center gap-4">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <kbd className="font-mono bg-muted border rounded px-1">↑↓</kbd> navigate
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <kbd className="font-mono bg-muted border rounded px-1">↵</kbd> open
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <kbd className="font-mono bg-muted border rounded px-1">Esc</kbd> close
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
