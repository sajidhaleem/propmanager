// PropManager Service Worker v2.0
const CACHE_VERSION = 'v2'
const STATIC_CACHE = `propmanager-static-${CACHE_VERSION}`
const API_CACHE = `propmanager-api-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Static Next.js chunks → cache-first, immutable
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Icons / manifest / offline page → cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === OFFLINE_URL
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // API routes → network-first, short-lived cache for dashboard data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstAPI(request))
    return
  }

  // HTML pages → network-first, offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstHTML(request))
    return
  }
})

// ── Helpers ───────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || new Response('Not found', { status: 404 })
  }
}

async function networkFirstAPI(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response(
      JSON.stringify({ success: false, error: 'Offline — cached data unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function networkFirstHTML(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return caches.match(OFFLINE_URL)
  }
}

// ── Push Notifications ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'PropManager', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title || 'PropManager', {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: data.tag || 'propmanager',
      renotify: true,
      data: { url: data.url || '/dashboard' },
      actions: data.actions || [],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => c.url.includes(self.location.origin))
        if (existing) { existing.focus(); existing.navigate(targetUrl) }
        else clients.openWindow(targetUrl)
      })
  )
})

// ── Skip waiting on message ───────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
