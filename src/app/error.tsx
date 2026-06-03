'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              An unexpected error occurred. This has been logged and we'll look into it.
            </p>
            {error.digest && (
              <p className="text-xs text-slate-600 font-mono">Error ID: {error.digest}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
            >
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
