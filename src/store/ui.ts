import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { JWTPayload } from '@/lib/auth'
import { DEFAULT_CURRENCY } from '@/lib/currencies'

interface UIState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  user: JWTPayload | null
  setUser: (user: JWTPayload | null) => void
  // ── Currency ──
  currency: string
  setCurrency: (code: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      user: null,
      setUser: (user) => set({ user }),
      currency: DEFAULT_CURRENCY,
      setCurrency: (code) => set({ currency: code }),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        currency: state.currency,
      }),
    }
  )
)
