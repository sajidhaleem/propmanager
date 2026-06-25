'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const INACTIVE_MS = 30 * 60 * 1000   // 30 minutes
const WARNING_MS  = 60 * 1000         // show warning 60 s before logout

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

export function InactivityGuard() {
  const router = useRouter()
  const lastActivityRef = useRef(Date.now())
  const warningTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown]     = useState(60)

  const logout = useCallback(async () => {
    clearTimers()
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login?reason=inactivity')
  }, [router])

  function clearTimers() {
    if (warningTimerRef.current)  clearTimeout(warningTimerRef.current)
    if (logoutTimerRef.current)   clearTimeout(logoutTimerRef.current)
    if (countdownRef.current)     clearInterval(countdownRef.current)
  }

  const scheduleWarning = useCallback(() => {
    clearTimers()
    setShowWarning(false)

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true)
      setCountdown(60)

      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      logoutTimerRef.current = setTimeout(() => {
        logout()
      }, WARNING_MS)
    }, INACTIVE_MS - WARNING_MS)
  }, [logout])

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (showWarning) return   // don't reset while warning is visible
    scheduleWarning()
  }, [showWarning, scheduleWarning])

  function stayLoggedIn() {
    setShowWarning(false)
    scheduleWarning()
  }

  useEffect(() => {
    scheduleWarning()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))
    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [handleActivity, scheduleWarning])

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Session expiring</DialogTitle>
          <DialogDescription>
            You've been inactive for 30 minutes. You'll be logged out in{' '}
            <span className="font-semibold text-foreground">{countdown}s</span> unless you
            continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={logout}>Log out now</Button>
          <Button onClick={stayLoggedIn}>Stay logged in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
