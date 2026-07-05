import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { PWARegister } from '@/components/PWARegister'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600'],
  style: ['normal'],
})

export const metadata: Metadata = {
  title: {
    default: 'PropManager — Short-Term Rental Management',
    template: '%s | PropManager',
  },
  description: 'Professional property management platform for short-term rentals. Track bookings, income, expenses and payouts in one place.',
  keywords: ['property management', 'airbnb', 'short-term rental', 'booking', 'income tracking'],
  authors: [{ name: 'PropManager' }],
  creator: 'PropManager',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PropManager',
    startupImage: [
      { url: '/icons/icon-512x512.png', media: '(device-width: 390px)' },
    ],
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'PropManager',
    title: 'PropManager — Property Management',
    description: 'Professional short-term rental management platform',
  },
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icons/icon-96x96.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#a8461f' },
    { media: '(prefers-color-scheme: dark)', color: '#2a1712' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="msapplication-TileColor" content="#a8461f" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  )
}
