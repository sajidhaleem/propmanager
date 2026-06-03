import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { JWTPayload } from '@/lib/auth'

interface UIState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  user: JWTPayload | null
  setUser: (user: JWTPayload | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      user: null,
      setUser: (user) => set({ user }),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
)
