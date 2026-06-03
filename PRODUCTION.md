# PropManager — Complete Production Deployment Guide

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     PRODUCTION ARCHITECTURE                       │
│                                                                   │
│   Android / iOS / Desktop Browser                                 │
│          │                                                        │
│          ▼                                                        │
│   Netlify Edge CDN  ←── HTTPS / TLS 1.3                         │
│   ├─ Static Assets (immutable, 1yr cache)                        │
│   ├─ Security Headers (CSP, HSTS, X-Frame)                       │
│   └─ Rate Limiting (middleware, 120 req/min)                     │
│          │                                                        │
│          ▼                                                        │
│   Next.js 15 App (Netlify Serverless Functions)                  │
│   ├─ Pages:  React Server Components + Client                    │
│   ├─ API:    /api/* routes (JWT auth + RBAC)                     │
│   ├─ Auth:   Custom JWT, HTTP-only cookies                       │
│   └─ PWA:    Service Worker + Web Manifest                       │
│          │                                                        │
│          ▼                                                        │
│   Prisma ORM  ←── Connection Pooling (PgBouncer)                │
│          │                                                        │
│          ▼                                                        │
│   Neon PostgreSQL  ←── Serverless, auto-scales                   │
│   └─ Automatic daily backups, 7-day PITR                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Recommended Hosting Stack

| Layer         | Service           | Free Tier        | Cost (paid)     |
|---------------|-------------------|------------------|-----------------|
| Frontend/API  | **Netlify**       | 100 GB bandwidth | $19/mo Pro      |
| Database      | **Neon**          | 0.5 GB, 1 branch | $19/mo Launch   |
| Monitoring    | **Sentry**        | 5K errors/mo     | $26/mo Team     |
| Analytics     | **PostHog**       | 1M events/mo     | Free up to 1M   |
| Email         | **Resend**        | 100 emails/day   | $20/mo Pro      |
| Uptime        | **BetterUptime**  | 10 monitors      | Free            |

---

## STEP 1 — Cloud PostgreSQL (Neon)

### Setup in 5 minutes

1. Create account → https://neon.tech
2. **New Project** → Name: `propmanager` → Region: pick closest
3. Copy the two connection strings from the dashboard:

```bash
# Pooled connection (use for DATABASE_URL)
postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/propmanager?sslmode=require&pgbouncer=true&connect_timeout=15

# Direct connection (use for DIRECT_URL — for migrations only)
postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/propmanager?sslmode=require
```

4. Run migrations against the direct URL:

```bash
# In your .env.local or terminal:
DIRECT_URL="postgresql://..." npx prisma migrate deploy

# Seed demo data (optional — remove for real production):
DATABASE_URL="postgresql://..." npm run db:seed
```

### Why two URLs?
- `DATABASE_URL` → uses PgBouncer pooling → handles 1000s of concurrent requests
- `DIRECT_URL` → bypasses pooling → required for DDL migrations

---

## STEP 2 — Netlify Deployment

### Option A: Git-connected auto-deploy (Recommended)

```bash
# 1. Push to GitHub
git add . && git commit -m "production ready" && git push

# 2. Netlify UI → Add new site → Import from Git → Select repo
# 3. Build settings are auto-detected from netlify.toml
# 4. Add environment variables (see STEP 3)
# 5. Click Deploy
```

### Option B: Manual CLI deploy

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Authenticate
netlify login

# Link to your site (or create new one)
netlify init

# Deploy
netlify deploy --prod
```

### netlify.toml (already in repo)
Build command: `npx prisma generate && npm run build`
Publish dir: `.next`
Plugin: `@netlify/plugin-nextjs` (handles SSR routing automatically)

---

## STEP 3 — Environment Variables

Set ALL of these in **Netlify → Site Settings → Environment Variables**:

```bash
# ── Required ─────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# Generate secrets:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
JWT_SECRET="<32+ random chars>"
NEXTAUTH_SECRET="<32+ random chars, different from JWT_SECRET>"

NEXTAUTH_URL="https://your-site.netlify.app"
NEXT_PUBLIC_APP_URL="https://your-site.netlify.app"
NEXT_PUBLIC_APP_NAME="PropManager"
NODE_ENV="production"
NEXT_TELEMETRY_DISABLED="1"

# ── GitHub Actions (Secrets → Repository secrets) ─────────────────
# NETLIFY_AUTH_TOKEN   →  Netlify User Settings → Personal access tokens
# NETLIFY_SITE_ID      →  Site Settings → General → Site ID
# DATABASE_URL         →  same as above
# DIRECT_URL           →  same as above
# JWT_SECRET           →  same as above
# NEXTAUTH_SECRET      →  same as above
# NEXTAUTH_URL         →  same as above

# ── Optional ─────────────────────────────────────────────────────
SENTRY_DSN="https://xxx@sentry.io/xxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
```

---

## STEP 4 — Android App

### Option A: Instant PWA Install (Zero Setup — Works Now!)

Your app is a **full PWA** out of the box. No build step needed:

1. Deploy to Netlify (Step 2)
2. Open the URL in **Chrome on Android**
3. Chrome shows **"Add to Home screen"** banner automatically
4. Tap → App installs with your icon, opens in full-screen standalone mode
5. Push notifications work via the service worker

**This gives you:**
- Native-like full-screen experience
- Custom app icon on home screen
- Offline support (previously loaded pages/data)
- Push notifications (if you add web push)
- Fast launch time

### Option B: Play Store APK via Trusted Web Activity (TWA)

Packages your PWA as a native Android app listed on Google Play:

```bash
# Prerequisites: Java JDK 11+, Android Studio (or Android SDK CLI)
npm install -g @bubblewrap/cli

# Update twa/twa-manifest.json with your actual domain first, then:
cd twa
bubblewrap init --manifest https://your-site.netlify.app/manifest.json

# Build the APK / AAB
bubblewrap build

# The output:
# - app-release-unsigned.apk  → install directly on Android
# - app-release.aab           → upload to Google Play Console
```

### Digital Asset Links (Required for TWA)

After building, get your signing certificate fingerprint:
```bash
keytool -list -v -keystore propmanager.keystore | grep "SHA256:"
```

Update `public/.well-known/assetlinks.json` with the fingerprint:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.propmanager.app",
    "sha256_cert_fingerprints": ["AA:BB:CC:...your actual fingerprint..."]
  }
}]
```

Deploy the updated file → TWA removes the browser address bar.

---

## STEP 5 — Custom Domain

```bash
# 1. Netlify → Domain settings → Add custom domain: app.yourdomain.com
# 2. Add CNAME record at your DNS provider:
#    app.yourdomain.com → your-site.netlify.app
# 3. Netlify auto-provisions Let's Encrypt HTTPS certificate
# 4. Update env vars:
#    NEXTAUTH_URL = https://app.yourdomain.com
#    NEXT_PUBLIC_APP_URL = https://app.yourdomain.com
# 5. Redeploy
```

---

## Security Checklist

| Item                        | Status        | Notes                                 |
|-----------------------------|---------------|---------------------------------------|
| JWT_SECRET ≥ 32 chars       | ✅ Enforced   | via jose library                      |
| bcrypt password hashing     | ✅ Done       | 12 rounds                             |
| HTTP-only cookies           | ✅ Done       | SameSite=lax                          |
| Rate limiting               | ✅ Done       | 10/15min auth, 120/min API            |
| HTTPS enforced              | ✅ Netlify    | Auto TLS + HSTS header                |
| Security headers            | ✅ Done       | CSP, X-Frame, X-Content-Type, etc.    |
| SQL injection prevention    | ✅ Prisma ORM | Parameterized queries                 |
| Input validation            | ✅ Zod        | On all API endpoints                  |
| RBAC                        | ✅ Done       | Admin/Manager/Staff middleware        |
| `poweredByHeader: false`    | ✅ Done       | Hides Next.js version                 |

---

## Production Checklist

### Before first deploy
- [ ] Neon project created and connection strings copied
- [ ] Migrations run: `npx prisma migrate deploy`
- [ ] All env vars set in Netlify dashboard
- [ ] Build succeeds locally: `npm run build`
- [ ] Icons generated: `node scripts/generate-icons.mjs`

### After first deploy
- [ ] Login works at `/login`
- [ ] Dashboard loads with real or seeded data
- [ ] Bookings CRUD works end-to-end
- [ ] Reports generate correctly
- [ ] `/api/health` returns `{ "status": "ok", "db": { "status": "connected" } }`
- [ ] Dark mode toggles correctly
- [ ] Mobile layout renders properly (test at 375px width)
- [ ] PWA installs on Android (add to home screen works)

### For production users
- [ ] Demo seed users deleted or passwords changed
- [ ] Admin user created with real email
- [ ] Sentry connected for error tracking
- [ ] BetterUptime monitoring `/api/health`

---

## Monitoring

### Health endpoint
```
GET https://your-app.netlify.app/api/health
```
Returns: `{ status, db.status, db.latencyMs, uptime, timestamp }`

### Sentry integration (10 min setup)
```bash
npm install @sentry/nextjs --legacy-peer-deps
npx @sentry/wizard@latest -i nextjs
# Follow prompts → adds sentry.client.config.ts + sentry.server.config.ts
```

### Recommended uptime monitoring
```
BetterUptime → New monitor:
  URL: https://your-app.netlify.app/api/health
  Check interval: 3 minutes
  Alert via: email + Slack
```

---

## Scaling Path

```
Current setup (free):   Netlify Free + Neon Free  → 0-1K users/mo
Growth tier ($38/mo):   Netlify Pro + Neon Launch  → 1K-50K users/mo
Scale tier ($100+/mo):  Netlify Business + Neon Scale + Redis cache
Enterprise:             Vercel Enterprise + PlanetScale + Upstash Redis
```

---

## Database Backup Strategy

Neon provides:
- **7-day point-in-time recovery** on all plans (free included)
- **Branch-based development** — create a branch, test migrations, merge

Manual backup:
```bash
# Export entire database
pg_dump "$DATABASE_URL" --clean --no-acl --no-owner | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip -c backup-20250101.sql.gz | psql "$DATABASE_URL"
```

For automated backups, add to GitHub Actions:
```yaml
- name: Backup database
  run: pg_dump "$DATABASE_URL" | gzip > "backups/db-$(date +%Y%m%d).sql.gz"
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## QA Checklist

### Automated (run with `npm test` + `npm run test:e2e`)
- [ ] 31/31 unit tests pass (utils + validations)
- [ ] E2E: Login with valid credentials
- [ ] E2E: Dashboard loads stats
- [ ] E2E: Create booking via form
- [ ] E2E: Sidebar navigation to all pages
- [ ] E2E: Mobile layout at 375px
- [ ] E2E: Dark mode toggle

### Manual
- [ ] PWA install prompt appears in Chrome on Android
- [ ] Offline page shows when network disconnected
- [ ] Previously loaded pages work offline
- [ ] Push notification permission request works
- [ ] All forms validate and show errors
- [ ] Export to Excel works on all tables
- [ ] Calendar renders bookings correctly
- [ ] Reports P&L chart renders

---

## Folder Structure (Production)

```
property-manager/
├── .github/
│   └── workflows/
│       └── deploy.yml         ← CI/CD pipeline
├── prisma/
│   ├── schema.prisma          ← DB schema + pooling config
│   └── seed.ts                ← Demo data
├── public/
│   ├── .well-known/
│   │   └── assetlinks.json    ← Android TWA verification
│   ├── icons/                 ← PWA icons (8 sizes)
│   ├── manifest.json          ← Web App Manifest
│   ├── sw.js                  ← Service Worker
│   └── offline.html           ← Offline fallback page
├── scripts/
│   └── generate-icons.mjs     ← Icon generator
├── src/
│   ├── app/
│   │   ├── (auth)/            ← Login page (full-screen)
│   │   ├── (dashboard)/       ← All app pages + mobile nav
│   │   ├── api/               ← All REST API routes
│   │   ├── error.tsx          ← Global error boundary
│   │   ├── not-found.tsx      ← 404 page
│   │   ├── globals.css        ← Premium design tokens
│   │   └── layout.tsx         ← Root layout + PWA meta
│   ├── components/
│   │   ├── dashboard/         ← Stats cards, charts
│   │   ├── layout/            ← Sidebar, Header, MobileNav
│   │   ├── ui/                ← ShadCN-style primitives
│   │   ├── PWARegister.tsx    ← Service worker registration
│   │   └── Providers.tsx      ← Theme, Query, Toast
│   ├── hooks/
│   │   └── useAuth.ts         ← Auth hook
│   ├── lib/
│   │   ├── auth.ts            ← JWT + session
│   │   ├── db.ts              ← Prisma singleton
│   │   ├── rateLimit.ts       ← In-memory rate limiter
│   │   ├── utils.ts           ← Formatting utilities
│   │   └── validations.ts     ← Zod schemas
│   ├── middleware.ts           ← Auth + rate limit + security headers
│   ├── store/ui.ts            ← Zustand UI state
│   └── types/index.ts         ← Shared TypeScript types
├── tests/
│   ├── unit/                  ← Jest unit tests
│   └── e2e/                   ← Playwright E2E tests
├── twa/
│   └── twa-manifest.json      ← Android TWA config
├── .env.example               ← Local dev env template
├── .env.production.example    ← Production env template
├── .eslintrc.json
├── .gitignore
├── docker-compose.yml         ← Local dev with Docker
├── Dockerfile                 ← Self-hosted deployment
├── netlify.toml               ← Netlify deployment config
├── next.config.ts             ← Production Next.js config
├── PRODUCTION.md              ← This file
├── SETUP.md                   ← Local dev setup
├── tailwind.config.ts
└── tsconfig.json
```
