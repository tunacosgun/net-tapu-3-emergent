# NetTapu Frontend Architecture Blueprint

**Date:** 2026-02-26
**Scope:** `apps/web` — Next.js 14, Zustand, Tailwind CSS, Socket.IO
**Status:** All 37 source files implemented. This document maps the current architecture, identifies production gaps, and proposes the next phases.

---

## 1. Tech Stack (Current)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14.2 (App Router) | SSR/SSG capable, route groups, middleware |
| State | Zustand 4.5 | Minimal boilerplate, SSR-safe, no provider tree pollution |
| HTTP | Axios 1.7 | Interceptors for auth refresh queue |
| WebSocket | Socket.IO Client 4.8 | Matches auction-service's Socket.IO v4 gateway |
| Styling | Tailwind CSS 3.4 | Utility-first, custom brand palette, CSS var theming |
| Language | TypeScript 5.4 | Strict types across all files |

**Not yet added (recommended for production):**

| Missing | Recommended | Purpose |
|---------|-------------|---------|
| Form library | react-hook-form + zod | Validation, error state, controlled inputs |
| Toast/notification | sonner or react-hot-toast | Replace custom `ApiErrorToastContainer` |
| Date formatting | date-fns (tr locale) | Consistent Turkish date/time across all pages |
| Image optimization | next/image | Lazy load, AVIF/WebP, CDN-ready |
| Testing | Playwright + Vitest | E2E flows + component unit tests |
| SEO | next/metadata per route | Dynamic OG tags for parcel/auction sharing |

---

## 2. Current Folder Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx                    # Root: <html lang="tr">, Inter font, AuthProvider, ErrorBoundary
│   ├── page.tsx                      # Landing: hero + TurkeyMap
│   ├── error.tsx                     # Global error boundary (500)
│   ├── not-found.tsx                 # 404 page
│   │
│   ├── (auth)/                       # Route group — no layout nesting with main nav
│   │   ├── layout.tsx                # Centered card wrapper
│   │   ├── login/page.tsx            # Email + password, returnTo redirect
│   │   └── register/page.tsx         # firstName, lastName, email, password, phone
│   │
│   ├── parcels/                      # Public listings
│   │   ├── layout.tsx                # Parcels layout wrapper
│   │   ├── page.tsx                  # Search, filter, paginated grid (12/page)
│   │   └── [id]/page.tsx             # Detail: images, specs, location, badges
│   │
│   ├── (auction)/                    # Route group — protected by middleware
│   │   ├── layout.tsx                # Auction header (logo + nav)
│   │   └── auctions/[id]/
│   │       ├── page.tsx              # Live auction: WS, bids, countdown, deposit gate
│   │       └── deposit/page.tsx      # Deposit payment + 3DS iframe redirect
│   │
│   ├── payment/
│   │   └── result/page.tsx           # Post-payment polling (up to 10 retries)
│   │
│   └── admin/                        # Protected: JwtAuthGuard + RolesGuard(admin)
│       ├── layout.tsx                # Sidebar nav, role check, logout
│       ├── page.tsx                  # Dashboard: finance summary + reconciliation
│       ├── parcels/                  # CRUD: list, create, edit
│       ├── auctions/                 # CRUD: list, create, detail+status
│       ├── deposits/page.tsx         # Filterable deposit table
│       ├── contacts/page.tsx         # CRM: inline status editing
│       ├── appointments/page.tsx     # CRM: inline create + status
│       ├── offers/page.tsx           # CRM: accept/reject actions
│       └── reconciliation/page.tsx   # Stale payments, settlements, trigger
│
├── components/
│   ├── api-error-toast.tsx           # Toast container for API errors
│   ├── connection-status.tsx         # WS connection indicator
│   ├── error-boundary.tsx            # React error boundary wrapper
│   ├── skeleton.tsx                  # Skeleton, CardSkeleton, TableSkeleton, PageSkeleton
│   └── turkey-map.tsx                # Interactive SVG: 81 provinces, auction aggregation
│
├── lib/
│   ├── api-client.ts                 # Axios + 401 refresh queue + auth header injection
│   ├── ws-client.ts                  # Socket.IO: connect/bid/disconnect, event handlers
│   ├── email-events.ts              # Email event helpers
│   └── env.ts                        # Environment variable access
│
├── providers/
│   └── auth-provider.tsx             # Silent refresh on mount, login/register/logout hooks
│
├── stores/
│   ├── auth-store.ts                 # Zustand: tokens in memory, user from JWT, sessionStorage for RT
│   ├── auction-store.ts              # Zustand: REST + WS hybrid, optimistic bids, 50-item feed
│   └── connection-store.ts           # Zustand: WS status (disconnected/connecting/connected/reconnecting)
│
└── types/
    └── index.ts                      # 15+ types: Parcel, Auction, Deposit, Payment, CRM, Reconciliation
```

---

## 3. Routing Structure

### Public Routes (no auth)
| Path | Page | Data Source |
|------|------|-------------|
| `/` | Landing + TurkeyMap | `GET /auctions?limit=100` |
| `/parcels` | Listing grid + search | `GET /parcels?page&city&search&status=active` |
| `/parcels/:id` | Parcel detail | `GET /parcels/:id` + `GET /parcels/:id/images` |
| `/login` | Login form | `POST /auth/login` |
| `/register` | Register form | `POST /auth/register` |

### Protected Routes (session cookie required)
| Path | Page | Data Source |
|------|------|-------------|
| `/auctions/:id` | Live auction | WS `join_auction` + `GET /auctions/:id` + `GET /deposits/my?auctionId` |
| `/auctions/:id/deposit` | Deposit payment | `POST /payments` (idempotency key) |
| `/payment/result` | Post-payment polling | `GET /payments/:id` (up to 10 retries) |

### Admin Routes (session cookie + admin role)
| Path | Page | Data Source |
|------|------|-------------|
| `/admin` | Dashboard | `GET /admin/finance/summary` + `GET /admin/reconciliation` |
| `/admin/parcels` | Parcel list | `GET /parcels?page&limit` |
| `/admin/parcels/new` | Create parcel | `POST /parcels` |
| `/admin/parcels/:id` | Edit parcel | `GET /parcels/:id` + `PATCH /parcels/:id` |
| `/admin/auctions` | Auction list | `GET /auctions?page&limit` |
| `/admin/auctions/new` | Create auction | `POST /auctions` |
| `/admin/auctions/:id` | Auction detail/status | `GET /auctions/:id` + `PATCH /auctions/:id/status` |
| `/admin/deposits` | Deposit table | `GET /admin/finance/deposits?status&auctionId` |
| `/admin/contacts` | CRM contacts | `GET /crm/contact-requests` + `PATCH` |
| `/admin/appointments` | CRM appointments | `GET /crm/appointments` + `POST` + `PATCH` |
| `/admin/offers` | CRM offers | `GET /crm/offers` + `POST /crm/offers/:id/respond` |
| `/admin/reconciliation` | Reconciliation | `GET /admin/reconciliation` + `GET /admin/settlements` + `POST trigger` |

### Middleware Protection Model
```
middleware.ts → checks cookie `has_session=1`
  ├── /auctions/*   → redirect to /login?returnTo=
  ├── /profile/*     → redirect to /login?returnTo=
  └── /admin/*       → redirect to /login?returnTo=
                       (admin role check happens in admin/layout.tsx client-side)
```

---

## 4. Auth & Token Architecture

```
                 ┌──────────────────────────────────┐
                 │       Browser Memory (Zustand)     │
                 │  accessToken: string               │
                 │  refreshToken: string               │
                 │  user: { sub, email, roles }       │
                 └──────────┬───────────────────┬─────┘
                            │                   │
                   write on login          read on every request
                            │                   │
                 ┌──────────▼───────┐  ┌────────▼──────────┐
                 │  sessionStorage   │  │  Axios Interceptor │
                 │  key: "rt"        │  │  Authorization:    │
                 │  (refresh token)  │  │  Bearer <access>   │
                 └──────────────────┘  └────────┬──────────┘
                                                │
                                        on 401 response
                                                │
                                       ┌────────▼──────────┐
                                       │  Refresh Queue     │
                                       │  POST /auth/refresh │
                                       │  Retry all queued   │
                                       └───────────────────┘
```

**Design decisions:**
- Access token: Zustand memory only (not localStorage, not cookies) — XSS cannot exfiltrate
- Refresh token: `sessionStorage` under key `rt` — survives page reload, dies on tab close
- Session cookie `has_session=1`: set on login, checked by Edge middleware for route protection. Not a security boundary — the JWT is the real auth.
- Silent refresh on mount: `AuthProvider` reads `rt` from sessionStorage, calls `/auth/refresh`, populates store
- Refresh queue: concurrent 401s queue behind a single refresh call, all retry with new token

---

## 5. API Layer Structure

```
api-client.ts (Axios instance)
  ├── baseURL: /api/v1 (proxied by Next.js rewrites)
  ├── Request interceptor: attach Bearer token from auth store
  ├── Response interceptor:
  │   ├── 401 + not auth endpoint + not retried → queue & refresh
  │   ├── 401 + refresh fails → clearTokens(), reject all queued
  │   └── Other errors → pass through
  └── Excludes: /auth/login, /auth/register, /auth/refresh from retry

next.config.js rewrites:
  /api/v1/auctions/*            → auction-service :3001
  /api/v1/bids/*                → auction-service :3001
  /api/v1/admin/settlements/*   → auction-service :3001
  /api/v1/admin/finance/*       → auction-service :3001
  /api/v1/*                     → monolith :3000  (catch-all, must be last)
```

---

## 6. UI Architecture

### Layout System
- **Root layout** (`app/layout.tsx`): font, `<html lang="tr">`, AuthProvider, ErrorBoundary, toast
- **Auth layout** (`(auth)/layout.tsx`): centered card, no nav
- **Auction layout** (`(auction)/layout.tsx`): minimal header with logo + nav links
- **Admin layout** (`admin/layout.tsx`): sidebar with 5 sections, role gate, authenticated header
- **Parcels layout** (`parcels/layout.tsx`): pass-through wrapper

### Component Strategy
| Category | Current | Pattern |
|----------|---------|---------|
| Loading | `Skeleton`, `CardSkeleton`, `TableSkeleton`, `PageSkeleton` | Pulse animation, CSS var themed |
| Errors | `ErrorBoundary` (React), `error.tsx` (Next.js), `ApiErrorToastContainer` | Global catch + toast per API call |
| Maps | `TurkeyMap` — 81 provinces, auction data overlay | SVG circles, color by status, click → route |
| WS status | `ConnectionStatus` — dot indicator | Reads from `useConnectionStore` |
| Forms | Raw controlled inputs | **Gap: no form library** |
| Modals | None | **Gap: no modal system** |

### Missing UI Primitives (Recommended)

| Component | Purpose | Priority |
|-----------|---------|----------|
| `<Modal>` | Confirmation dialogs (delete parcel, cancel auction, accept offer) | High |
| `<DataTable>` | Sortable/filterable table with pagination (admin tables are currently hand-rolled) | Medium |
| `<Badge>` | Status badges (currently inline Tailwind spans) | Low |
| `<FormField>` | Label + input + error + description wrapper | High (with form library) |
| `<ConfirmDialog>` | "Are you sure?" pattern for destructive actions | High |
| `<EmptyState>` | Consistent "no data" illustrations | Low |
| `<Breadcrumb>` | Reusable (currently only in parcel detail) | Low |

---

## 7. Security Considerations

### Current Posture

| Vector | Status | Implementation |
|--------|--------|----------------|
| Token storage | Secure | Memory-only access token, sessionStorage refresh token |
| XSS → token theft | Mitigated | No localStorage, no cookies with token |
| CSRF | N/A | Bearer token auth (not cookie-based) |
| Role-based rendering | Implemented | `admin/layout.tsx` checks `user.roles` before render |
| Role-based routing | Partial | Middleware checks session cookie, but role check is client-side only |
| API error handling | Implemented | `showApiError()` toast, error boundaries |
| Rate limit UI | **Not implemented** | 429 responses from API not handled in UI (no retry indicator, no backoff message) |
| Content Security Policy | Headers set | `next.config.js` headers: X-Frame-Options DENY, X-Content-Type-Options nosniff |
| Input validation | Partial | DTO validation is server-side; client has HTML5 `required` only |

### Gaps to Address

1. **Admin role check is client-only.** Middleware checks `has_session` cookie but not role. A regular user can navigate to `/admin` and see a flash before the client-side role check redirects. Fix: decode JWT in middleware or add a server-side role cookie.

2. **No 429 handling in UI.** When rate-limited, the user sees a generic error. Should show a specific "Too many requests — try again in X seconds" message with the `Retry-After` header value.

3. **No client-side input validation.** All validation is server-side (class-validator in NestJS). Adding react-hook-form + zod schemas matching the backend DTOs would prevent unnecessary round-trips and improve UX.

---

## 8. Proposed Folder Tree (Target State)

New additions marked with `+`:

```
apps/web/src/
├── app/                              # (unchanged — all pages exist)
│   ├── profile/                      # + User profile/settings
│   │   ├── page.tsx                  # + Account info, change password
│   │   └── payments/page.tsx         # + Payment history
│   └── auctions/                     # + Public auction listing
│       └── page.tsx                  # + Browse all auctions (no auth required)
│
├── components/
│   ├── ui/                           # + Reusable primitives
│   │   ├── modal.tsx                 # + Dialog wrapper (portal-based)
│   │   ├── confirm-dialog.tsx        # + "Are you sure?" pattern
│   │   ├── data-table.tsx            # + Sortable table with pagination
│   │   ├── form-field.tsx            # + Label + input + error wrapper
│   │   ├── badge.tsx                 # + Status badge variants
│   │   └── spinner.tsx               # + Loading spinner
│   ├── layout/                       # + Shared layout parts
│   │   ├── header.tsx                # + Public header (nav, auth buttons)
│   │   └── footer.tsx                # + Site footer
│   └── (existing files)
│
├── hooks/                            # + Custom hooks
│   ├── use-pagination.ts             # + Shared pagination logic
│   ├── use-debounce.ts               # + Search input debouncing
│   └── use-countdown.ts              # + Auction timer (extracted from page)
│
├── lib/
│   ├── validators/                   # + Zod schemas matching backend DTOs
│   │   ├── auth.ts                   # + login, register schemas
│   │   └── payment.ts                # + initiate-payment schema
│   └── (existing files)
│
└── (existing stores/, providers/, types/)
```

---

## 9. High-Level Component Map

```
Landing (/)
├── Header (logo, nav: Arsalar | Açık Artırmalar | Giriş)
├── Hero (CTA buttons)
├── TurkeyMap (auction overlay, click → /parcels?city=)
└── Footer

Parcels (/parcels)
├── Header
├── SearchBar (debounced)
├── FilterBar (city, status, sort)
├── ParcelGrid → ParcelCard[]
├── Pagination
└── Footer

Parcel Detail (/parcels/:id)
├── Header
├── Breadcrumb
├── ImageGallery (next/image, lightbox)
├── SpecGrid (price, area, zoning, ada/parsel)
├── Description
├── CTAs (Teklif Ver → modal, Açık Artırma → link)
└── Footer

Live Auction (/auctions/:id)
├── AuctionLayout
├── ConnectionStatus
├── AuctionHeader (title, status badge)
├── PriceDisplay (current price, min increment)
├── CountdownTimer
├── BidForm (deposit-gated, optimistic)
├── BidFeed (50 items, real-time)
├── ParticipantBar (count, watcher count)
└── EndedOverlay (winner, final price)

Admin (/admin/*)
├── AdminLayout (sidebar, role gate)
├── AdminDashboard (stat cards, charts)
├── DataTable (reused across all list pages)
├── CRUD Forms (parcel, auction, appointment)
└── ReconciliationPanel (stale payments, settlements)
```

---

## 10. Phase-by-Phase Implementation Order

### Phase 1 — Production Hardening (no new pages)
| Task | Files | Impact |
|------|-------|--------|
| Add react-hook-form + zod | `lib/validators/`, all form pages | Client-side validation |
| Add sonner for toasts | Replace `api-error-toast.tsx` | Better UX, auto-dismiss |
| Add `<Modal>` + `<ConfirmDialog>` | `components/ui/` | Safe destructive actions in admin |
| Handle 429 in api-client | `lib/api-client.ts` | Show retry message, parse Retry-After |
| Middleware role check | `middleware.ts` | Prevent admin flash for non-admin users |
| Replace `<img>` with `next/image` | Parcel detail, admin | Performance, CDN-ready |

### Phase 2 — Missing Public Pages
| Task | Files | Impact |
|------|-------|--------|
| Public auction list (`/auctions`) | `app/auctions/page.tsx` | Users can browse auctions without auth |
| Public header + footer | `components/layout/` | Consistent navigation across public pages |
| User profile (`/profile`) | `app/profile/page.tsx` | Account info, change password |
| Payment history (`/profile/payments`) | `app/profile/payments/page.tsx` | User sees their payments |

### Phase 3 — UX Polish
| Task | Files | Impact |
|------|-------|--------|
| Extract `<DataTable>` | `components/ui/data-table.tsx` | DRY admin tables (9 list pages) |
| Image lightbox for parcel gallery | `components/ui/lightbox.tsx` | Zoom/swipe on parcel images |
| Search debouncing | `hooks/use-debounce.ts` | Reduce API calls on parcel search |
| Countdown hook extraction | `hooks/use-countdown.ts` | Reusable timer logic |
| Auction sound notifications | `lib/ws-client.ts` | Audio cue on new bid / auction ending |
| Skeleton per page (replace generic) | Per page | More accurate loading previews |

### Phase 4 — SEO & Performance
| Task | Files | Impact |
|------|-------|--------|
| Per-route metadata | `app/parcels/[id]/page.tsx` etc. | OG tags for social sharing |
| SSR for public pages | Parcels, parcel detail | Crawlable by search engines |
| Bundle analysis | `next.config.js` | Tree-shake unused code |
| Prefetch on hover | Parcel cards, auction cards | Faster navigation |

### Phase 5 — Testing
| Task | Tooling | Coverage |
|------|---------|----------|
| Playwright E2E | Login → browse → auction → bid → deposit | Critical user flow |
| Vitest component tests | Form validation, auction store, api-client interceptor | Unit coverage |
| Accessibility audit | axe-core | WCAG 2.1 AA compliance |

---

## 11. Production Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| All pages implemented | Complete | 22 pages, all functional |
| Auth flow | Complete | Login, register, refresh, logout, role gate |
| API integration | Complete | All backend endpoints wired |
| WebSocket | Complete | Live auction, optimistic bids, reconnection |
| Admin panel | Complete | 10 admin pages with CRUD |
| CRM | Complete | Contacts, appointments, offers |
| Payments/3DS | Complete | Deposit, 3DS iframe, result polling |
| Map | Complete | 81 provinces, auction overlay |
| **Client validation** | **Gap** | Server-only; needs react-hook-form + zod |
| **Rate limit UX** | **Gap** | 429 not handled in UI |
| **Admin middleware role** | **Gap** | Client-only check; brief flash possible |
| **Testing** | **Gap** | No E2E or unit tests |
| **SEO** | **Gap** | No per-route metadata or SSR on public pages |
