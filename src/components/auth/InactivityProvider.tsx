'use client'

import { InactivityGuard } from './InactivityGuard'

export function InactivityProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InactivityGuard />
      {children}
    </>
  )
}
