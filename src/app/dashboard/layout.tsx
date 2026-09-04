import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { SideNav } from '@/components/layout/SideNav'
import { MobileNav } from '@/components/layout/MobileNav'
import { InactivityGuard } from '@/components/auth/InactivityGuard'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <>
      <InactivityGuard />
      {/* The app frame floats on a lighter canvas, so its rounded edge reads */}
      <div className="app-canvas min-h-[100dvh] lg:p-4">
        {/* Sidebar beside the content, so navigation costs height on no screen */}
        <div className="app-frame flex h-[100dvh] overflow-hidden lg:h-[calc(100dvh-2rem)]">
          <SideNav />
          <main className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
            <div className="container-app py-5 pb-24 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </>
  )
}
