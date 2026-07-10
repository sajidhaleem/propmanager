# 52A Property Manager

## Skills (use these — do not skip)

| When | Skill |
| --- | --- |
| Building or editing dashboard charts | `/dataviz` FIRST — before any chart code |
| Any new UI screen or component | `/frontend-design` |
| After fixing a bug in any API route | `/verify` — run the real app, confirm it works |
| Before committing API/schema/auth changes | `/code-review` |
| Before pushing auth, CNIC, or Hotel Eye changes | `/security-review` |
| Exporting bookings or income to spreadsheet | `/xlsx` |
| Generating PDF booking summaries or P&L reports | `/pdf` |
| Testing UI flows (login, booking, scanner) | `/webapp-testing` |

## Project: 52A Property Manager

**Stack**: Next.js 15 (App Router), Prisma v7, Neon PostgreSQL, Tailwind CSS, shadcn/ui  
**Deployment**: Netlify → `52apropmanager.netlify.app` (repo: `sajidhaleem/propmanager`)  
**Auth**: Custom JWT (HTTP-only cookies, bcrypt, RBAC: Admin > Manager > Staff)

### Key files

- `src/lib/db.ts` — Prisma singleton
- `src/lib/auth.ts` — JWT sign/verify, session helpers
- `src/lib/validations.ts` — Zod schemas for all API inputs
- `src/lib/utils.ts` — Formatting helpers
- `src/lib/rateLimit.ts` — In-memory rate limiter (10/15min auth, 120/min API)
- `src/app/api/` — REST routes: `auth/`, `bookings/`, `properties/`, `income/`, `expenses/`, `payouts/`, `reports/`, `dashboard/`, `cnic-extract/`, `hotel-eye/`, `health/`
- `src/app/(dashboard)/` — All app pages + mobile nav

### Features

- **CNIC Scanner**: `src/app/api/cnic-extract/` — Claude Vision OCR extracts Pakistani CNIC fields from photo
- **Hotel Eye Push**: `src/app/api/hotel-eye/` — pushes guest data to `hoteleye.punjab.gov.pk` (calls Hotel Eye CNIC Tool at `localhost:5000`)
- **Bookings**: full CRUD, linked to Income records, multi-currency, multi-platform
- **Reports**: P&L by month/property/platform, exportable
- **PWA**: full offline support, add-to-home-screen on Android

### Database

Two connection strings required (Neon):
- `DATABASE_URL` — pooled (PgBouncer), for runtime queries
- `DIRECT_URL` — direct, for `prisma migrate deploy` only

### Rules

- Run `npx prisma generate` after any schema change
- All API routes require JWT auth via `src/lib/auth.ts` middleware
- CNIC extract calls Claude `claude-haiku-4-5-20251001` with base64 image
- Hotel Eye push depends on the standalone Python Flask tool running on port 5000
- See `PRODUCTION.md` for full deployment checklist and env vars
- See `SETUP.md` for local dev setup and demo credentials
