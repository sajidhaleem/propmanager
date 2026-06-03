# PropManager — Setup & Deployment Guide

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or Docker)
- npm 9+

### 1. Install dependencies
```bash
cd property-manager
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/property_manager?schema=public"
JWT_SECRET="your-super-secret-key-min-32-chars"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Set up database
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed demo data
npm run db:seed
```

### 4. Run development server
```bash
npm run dev
```

Open http://localhost:3000

**Demo login credentials:**
| Role    | Email                       | Password    |
|---------|-----------------------------|-------------|
| Admin   | admin@propmanager.com       | admin123    |
| Manager | manager@propmanager.com     | manager123  |
| Staff   | staff@propmanager.com       | staff123    |

---

## Docker Deployment

```bash
# Start everything with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

---

## Production Deployment

### Environment Variables (Required)
| Variable           | Description                        |
|--------------------|------------------------------------|
| DATABASE_URL       | PostgreSQL connection string       |
| JWT_SECRET         | Secret for JWT signing (32+ chars) |
| NEXTAUTH_SECRET    | Secret for NextAuth                |
| NEXTAUTH_URL       | Full app URL                       |
| NEXT_PUBLIC_APP_URL| Frontend URL                       |

### Build & Deploy
```bash
npm run build
npm run start
```

### Vercel Deployment
```bash
npm install -g vercel
vercel --prod
```
Set environment variables in Vercel dashboard.

### Database Migration in Production
```bash
npx prisma migrate deploy
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 15 App                    │
│  ┌──────────────┐    ┌─────────────────────────┐   │
│  │   Frontend   │    │      Backend API         │   │
│  │  React + TSX │    │    /api/* routes          │   │
│  │  TanStack Q  │◄──►│    JWT Auth               │   │
│  │  Zustand     │    │    Zod Validation         │   │
│  │  Recharts    │    │    RBAC                   │   │
│  └──────────────┘    └─────────┬───────────────┘   │
└────────────────────────────────┼────────────────────┘
                                 │
                    ┌────────────▼───────────┐
                    │   Prisma ORM           │
                    │   PostgreSQL           │
                    └────────────────────────┘
```

---

## API Documentation

### Authentication
- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/logout` — Logout (clears cookie)
- `GET  /api/auth/me` — Get current user
- `POST /api/auth/register` — Create user (Admin only)

### Properties
- `GET    /api/properties` — List all properties
- `POST   /api/properties` — Create property (Admin/Manager)
- `GET    /api/properties/:id` — Get property
- `PATCH  /api/properties/:id` — Update property (Admin/Manager)
- `DELETE /api/properties/:id` — Delete property (Admin)

### Bookings
- `GET    /api/bookings` — List bookings (filterable)
- `POST   /api/bookings` — Create booking
- `GET    /api/bookings/:id` — Get booking
- `PATCH  /api/bookings/:id` — Update booking
- `DELETE /api/bookings/:id` — Delete booking (Admin/Manager)

### Income
- `GET /api/income` — List income records (filterable by year/month)

### Expenses
- `GET    /api/expenses` — List expenses (filterable)
- `POST   /api/expenses` — Create expense (Admin/Manager)
- `PATCH  /api/expenses/:id` — Update expense
- `DELETE /api/expenses/:id` — Delete expense

### Payouts
- `GET    /api/payouts` — List payouts
- `POST   /api/payouts` — Create payout
- `PATCH  /api/payouts/:id` — Update payout
- `DELETE /api/payouts/:id` — Delete payout (Admin)

### Dashboard & Reports
- `GET /api/dashboard/stats` — Dashboard KPIs and charts data
- `GET /api/reports?year=2025&type=monthly|property|platform` — Reports

---

## Database Schema (ER Summary)

```
User
  └── AuditLog (many)

Property
  └── Booking (many)
       └── Income (one)

Expense (standalone)
Payout (standalone)
```

---

## Security Measures
- HTTP-only JWT cookies (7-day expiry)
- bcrypt password hashing (12 rounds)
- Zod input validation on all API endpoints
- Prisma parameterized queries (SQL injection prevention)
- RBAC: Admin > Manager > Staff permissions
- Middleware-level route protection
- CSRF protection via SameSite=lax cookies

---

## QA Report

### Unit Tests (Jest)
| Suite              | Tests | Status |
|--------------------|-------|--------|
| utils.test.ts      | 18    | ✅ Pass |
| validations.test.ts| 20    | ✅ Pass |
| **Total**          | **38**| ✅ Pass |

### E2E Tests (Playwright)
| Suite          | Tests | Status |
|----------------|-------|--------|
| Authentication | 4     | ✅ Pass |
| Dashboard      | 3     | ✅ Pass |
| Bookings       | 3     | ✅ Pass |
| Calendar       | 2     | ✅ Pass |
| Properties     | 1     | ✅ Pass |
| Reports        | 1     | ✅ Pass |
| **Total**      | **14**| ✅ Pass |

### API Coverage
| Endpoint          | GET | POST | PATCH | DELETE |
|-------------------|-----|------|-------|--------|
| /api/auth/*       | ✅  | ✅   | —     | —      |
| /api/properties   | ✅  | ✅   | ✅    | ✅     |
| /api/bookings     | ✅  | ✅   | ✅    | ✅     |
| /api/income       | ✅  | —    | —     | —      |
| /api/expenses     | ✅  | ✅   | ✅    | ✅     |
| /api/payouts      | ✅  | ✅   | ✅    | ✅     |
| /api/dashboard    | ✅  | —    | —     | —      |
| /api/reports      | ✅  | —    | —     | —      |
| /api/users        | ✅  | —    | ✅    | ✅     |

### Performance (Target Lighthouse Scores)
| Metric          | Score |
|-----------------|-------|
| Performance     | 90+   |
| Accessibility   | 90+   |
| Best Practices  | 95+   |
| SEO             | 85+   |

### Known Limitations
1. No real-time updates (requires page refresh for new bookings from other users)
2. File upload for expense receipts is schema-ready but UI upload not implemented
3. Email notifications configured but SMTP server not included
4. Google Sheets sync is planned but not implemented

### Future Enhancements
1. WebSocket real-time updates
2. Mobile native app (React Native)
3. Automated pricing suggestions based on occupancy
4. Guest messaging integration (SMS/Email)
5. Channel manager integration (Airbnb API, Booking.com API)
6. Multi-property owner support
7. Stripe payment processing for direct bookings
8. Automated cleaning schedule generation
9. Advanced analytics with ML predictions
10. Document/receipt storage with AWS S3
