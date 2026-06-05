'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Check, ChevronDown } from 'lucide-react'
import { CURRENCIES, POPULAR_CURRENCY_CODES, getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'

interface CurrencySelectorProps {
  value: string
  onChange: (code: string) => void
  className?: string
}

export function CurrencySelector({ value, onChange, className }: CurrencySelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = getCurrency(value)

  const popular = CURRENCIES.filter(c => POPULAR_CURRENCY_CODES.includes(c.code))
  const others = CURRENCIES.filter(c => !POPULAR_CURRENCY_CODES.includes(c.code))

  const filtered = search.trim()
    ? CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.includes(search)
      )
    : null

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  function select(code: string) {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  const CurrencyRow = ({ code, name, symbol, flag }: typeof CURRENCIES[0]) => (
    <button
      key={code}
      onClick={() => select(code)}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors',
        value === code && 'bg-primary/10 text-primary font-medium'
      )}
    >
      <span className="text-lg w-6 shrink-0">{flag}</span>
      <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{code}</span>
      <span className="flex-1 text-left truncate">{name}</span>
      <span className="text-muted-foreground text-xs">{symbol}</span>
      {value === code && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
    </button>
  )

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{selected.flag}</span>
          <span className="font-mono font-semibold">{selected.code}</span>
          <span className="text-muted-foreground hidden sm:block">— {selected.name}</span>
          <span className="text-muted-foreground text-xs">({selected.symbol})</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border bg-card shadow-xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search currency or code…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto p-2 scrollbar-thin">
            {filtered ? (
              filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">No currencies found</p>
              ) : (
                filtered.map(c => <CurrencyRow key={c.code} {...c} />)
              )
            ) : (
              <>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Popular
                </p>
                {popular.map(c => <CurrencyRow key={c.code} {...c} />)}
                <div className="my-2 border-t" />
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  All Currencies
                </p>
                {others.map(c => <CurrencyRow key={c.code} {...c} />)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
