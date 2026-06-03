import Link from 'next/link'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-1">
          <p className="text-8xl font-black tracking-tighter text-primary/20">404</p>
          <h1 className="text-2xl font-bold">Page not found</h1>
          <p className="text-muted-foreground text-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
