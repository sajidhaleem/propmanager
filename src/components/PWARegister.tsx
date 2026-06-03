'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              toast(
                (t) => (
                  <span className="flex items-center gap-3 text-sm">
                    Update available!
                    <button
                      className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium"
                      onClick={() => {
                        newWorker.postMessage({ type: 'SKIP_WAITING' })
                        window.location.reload()
                        toast.dismiss(t.id)
                      }}
                    >
                      Refresh
                    </button>
                  </span>
                ),
                { duration: Infinity, id: 'sw-update' }
              )
            }
          })
        })
      })
      .catch(() => {
        // SW registration failed silently in dev mode
      })
  }, [])

  return null
}
