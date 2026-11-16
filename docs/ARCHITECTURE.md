# AsteAI Platform – Developer Documentation

## Overview

AsteAI is a multi-sided AI-powered hiring and talent marketplace platform. This repo (`asteai-redo`) is the production rewrite of the `deeptech_backend` + `deeptech_frontend` monorepos.

### User roles
| Role | Description |
|------|-------------|
| **Employer** | HR / TA admins at tenant companies. Create requisitions, review assessments, manage pipeline. |
| **Candidate** | Job applicants. Take assessments, earn Talent Passports, track applications. |
| **Freelancer** | Independent experts. Bid on projects, receive milestone payments. |
| **Buyer** | Companies sourcing deeptech expertise. Post projects, fund milestones. |
| **Admin** | AsteAI Operations. Master control, feature flags, audit, growth/marketing. |

---

## Monorepo structure

```
asteai-redo/
├── apps/
│   ├── api/          # NestJS REST API (Node.js / Bun)
│   └── web/          # Next.js 14 App Router frontend
├── packages/
│   ├── types/        # Shared TypeScript types (consumed by both apps)
│   └── db/
│       └── migrations/  # Plain SQL migrations for AWS RDS (PostgreSQL 16)
└── docs/             # This documentation
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, CSS Modules |
| Backend | NestJS 10, TypeScript, Passport.js (JWT + Local) |
| Database | AWS RDS PostgreSQL 16 (via `pg` pool — no Supabase) |
| Auth | JWT access tokens (15 min) + refresh tokens (7 days) in `refresh_tokens` table |
| State (FE) | Zustand (persisted to localStorage) + SWR for server state |
| Package manager | **Bun** (workspaces) |
| Fonts | Sora (display), Manrope (body), JetBrains Mono |
| AI service | `deeptech_ai` — separate FastAPI service, proxied via `VoiceModule` |

---

## Getting started

### Prerequisites
- Bun >= 1.1
- PostgreSQL 16 (or AWS RDS endpoint)

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

**API:**
```bash
cp apps/api/.env.example apps/api/.env.local
# Fill in DATABASE_*, JWT_*, etc.
```

**Web:**
```bash
cp apps/web/.env.example apps/web/.env.local
```

### 3. Run database migrations

```bash
DATABASE_URL=postgres://... bun run --filter @asteai/db migrate
# `migrate:status` lists applied / pending files. On a database where the SQL was
# applied by hand, insert those file names into schema_migrations first.
```

### 4. Start development servers

```bash
bun run dev:api   # NestJS on :3001
bun run dev:web   # Next.js on :3000
```

### 5. Swagger docs
http://localhost:3001/api/docs (development only)

---

## API design

All endpoints live under `/api/v1/`. The global interceptor wraps every response:

```json
{ "data": <payload> }
```

Errors:
```json
{ "statusCode": 400, "message": "...", "errors": { "field": ["..."] } }
```

### Authentication flow
Browsers use HttpOnly cookies; no token is ever readable from JavaScript.
1. `POST /api/v1/auth/login` (or `/auth/register`, `/auth/login/2fa`) sets three cookies (`apps/api/src/modules/auth/session-cookies.ts`):
   - `asteai_at`: the access JWT (`JWT_EXPIRES_IN`, default 15m).
   - `asteai_rt`: the refresh token, scoped to path `/api/v1/auth` (`JWT_REFRESH_EXPIRES_IN`, default 7d).
   - `asteai_session`: a non-HttpOnly hint so the web app knows a session exists.

   The body returns `{ user, sessionId }`.
2. Protected requests send the cookies (`credentials: 'include'`). `Authorization: Bearer` is still accepted for server-to-server and test clients.
3. On 401, the web client calls `POST /api/v1/auth/refresh` once (single-flight), which rotates the refresh token.
4. `POST /api/v1/auth/logout` revokes the session and clears all three cookies.
5. OAuth: `GET /auth/oauth/:provider` (`google` | `github`) → provider → `GET /auth/oauth/:provider/callback`. Uses PKCE + signed `state`, links by verified email (`user_oauth_identities`), then sets the same cookies and redirects to `WEB_APP_URL`.

Cookie flags: `Secure` unless `COOKIE_SECURE=false` (local HTTP only), `SameSite=Lax`, optional `COOKIE_DOMAIN` for a shared parent domain.

### Credit-metered AI endpoints
Every AI endpoint follows the same contract so the web app and the API stay decoupled:
- **Strict JSON I/O.** The request is a validated DTO, and the model output is parsed and validated against a schema before anything is stored or returned. Malformed output is a 502, not a partial result.
- **Credit middleware.** The price of a feature key comes from `credit_costs`; credits are taken oldest-expiry first (FIFO).
  - `@UseInterceptors(CreditChargeInterceptor) @ChargeCredits('<feature>')` charges before the handler runs and returns 402 if the balance is short. If the handler throws, the charge is refunded. The new balance is sent as `X-Credits-Balance`.
  - Or wrap the work in `CreditsService.runMetered(userId, feature, task)`. Those endpoints return `credits: { charged, balance }`.
- Feature keys and seeded costs:

  | Feature | Key | Credits |
  |---------|-----|---------|
  | Résumé autofill | `expert_autofill` | 15 |
  | AI interview | `ai_interview` | 10 |
  | AI job creator | `ai_job_creator` | 15 |
  | AI & voice expert search | `ai_search` | 15 |

  Edit costs in `credit_costs`; the pricing page reads the same table.

### Rate limits (per IP)
- Short: 10 req/s
- Medium: 50 req/10s
- Long: 200 req/min

---

## Module overview

### `auth`
JWT + Passport local strategy. Refresh tokens persisted to DB.

### `users`
`GET /users/me` and `PUT /users/me`.

### `tenants`
Multi-tenant org management. Admins can list all; employers see their own.

### `requisitions`
Full CRUD for job openings. Tenant-scoped. `PATCH /:id/fund` activates SLA clock.

### `applications`
Candidate apply + employer pipeline management.
- `GET /applications/requisition/:reqId` — pipeline (Employer)
- `GET /applications/me` — my applications (Candidate)
- `POST /applications/:reqId/apply`
- `PATCH /applications/:id/stage`
- `POST /applications/:id/scorecards`

### `assessments`
- `POST /assessments/submit` — seal result, auto-flag integrity
- `GET /assessments/integrity-queue` (Admin)
- `PATCH /assessments/integrity-queue/:id/resolve`

### `passports`
Verifiable Talent Passports issued after sealed assessments.
- `GET /passports/me`
- `GET /passports/verify?hash=...` — public
- `PATCH /passports/:id/share`

### `projects`
Buyer marketplace projects with milestone JSONB.

### `proposals`
Freelancer bids; `PATCH /:id/award` triggers contract creation.

### `ledger`
Immutable transaction log. `GET /ledger/wallet` for freelancer earnings.

### `notifications`
Per-user notification feed with read tracking.

### `analytics`
- `GET /analytics/employer/dashboard`
- `GET /analytics/employer/fairness` — demographic breakdown

### `admin`
- `GET /admin/stats`
- `GET /admin/audit`
- `POST /admin/flags`

### `voice`
Proxy to `deeptech_ai` for translate and detect.

### `credits` (wallet)
Credit ledger with FIFO consumption and expiry; wallet balance = sum of open grants.
- `GET /credits/wallet`, `GET /credits/transactions`, `GET /credits/packs` (packs with up to 30% bulk discount)
- `POST /credits/topups` → Razorpay order; `POST /credits/topups/verify` (signature check, idempotent grant)
- `POST /credits/subscriptions` (Pro plan); `POST /credits/razorpay/webhook` (`RAZORPAY_CREDITS_WEBHOOK_SECRET`, exempt from throttling)

### `credentials` and `passports` (Career Studio)
- Ed25519-signed verifiable credentials (`CREDENTIAL_SIGNING_KEY`; old keys in `CREDENTIAL_RETIRED_PUBLIC_KEYS` keep verifying).
  `GET /verify/keys`, `GET /verify/:code` (public), `GET /credentials/me`, `POST /credentials/:code/revoke`
- Public talent passports: `GET /passports/:slug`, `GET /passports/benchmarks`, `GET/PATCH /passports/me/profile`, `POST /passports/me/credentials`

### `challenges`
Code challenges graded by Judge0: `GET /challenges`, `GET /challenges/:id`, `POST /challenges/:id/submissions`, `GET /challenges/:id/submissions`. Passing earns competency evidence.

### `interviews` (AI Interview Studio)
`POST /interviews/start` (10 credits), `POST /interviews/:id/turn`, `POST /interviews/:id/complete`, `GET /interviews/sessions/:id`. Supports a voice mode for frontline/trades roles. Scores go to `competency_scores`.

### `resumes`
S3 résumé upload with AI autofill. `POST /resumes/upload-url` returns a SigV4 presigned URL the browser uploads to directly (`RESUME_BUCKET`; type and size are limited); `POST /resumes/:id/autofill` (15 credits) parses it into the profile; `GET /resumes/me`.

### `job-creator`
`POST /ai/jobs/generate` (15 credits): title, description, skills, screening questions and a scoring rubric as strict JSON.

### `requisitions` (approvals)
`POST /requisitions/:id/submit-for-approval`; admins use `GET /admin/requisitions/approvals`, `POST /admin/requisitions/:id/approve|reject`. Pipeline stages now include `Screened` (`PATCH /applications/:id/stage` validates allowed transitions).

### `talent-pools` (Talent CRM)
Kanban pools per company (`crm_pools`, `crm_pool_members`): board, custom columns, bulk add (≤500), drag-and-drop with fractional positions. See `talent-pools.module.ts` for routes.

### `outreach`
Bulk email campaigns to a pool (`outreach_email_campaigns`, `outreach_email_messages`). Rate-limited by `OUTREACH_DAILY_LIMIT` and dispatched by a worker (`OUTREACH_DISPATCH_ENABLED`). Each message has a signed one-click unsubscribe (`GET /outreach/unsubscribe`) that writes to `outreach_suppressions`.

### `analytics` (hiring KPIs)
`GET /analytics/employer/hiring-kpis`: open and pending requisitions, active campaigns, median time-to-hire (to the `Joined` stage), match rate, and counts by stage. Tenant-scoped; admins see the whole platform.

### `expert-search`
`POST /experts/ai-search` (15 credits): natural-language or voice query → ranked verified experts with reasons.

### `contracts` (escrow) and `deliverables`
- Milestone escrow: fund → submit → accept / request revision → release.
  `POST /contracts/:id/milestones/:mid/approve-release` releases in one step; `POST /contracts/:id/milestones/:mid/dispute` freezes the milestone and opens a dispute.
- Proposals carry a statement of work (`GET /proposals/:id/contract-draft` turns it into the contract draft).
- Deliverable files: `POST /deliverables/upload-url` (S3, `DELIVERABLE_BUCKET`), `GET /deliverables`, `GET /deliverables/:id/download` (short-lived signed URL, contract parties only).

---

## Database schema

Migrations: `packages/db/migrations/001–028`, applied in filename order by `packages/db/migrate.mjs`. Each file runs once, in its own transaction, and is recorded in `schema_migrations`. Files are written to be re-runnable (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

| Migration | Adds |
|-----------|------|
| 001–014 | Core schema, interviews, assessments, email outbox, messaging, profiles, contracts, payments, invoices/payouts, disputes, gigs |
| 015–020 | Marketing forms, plans + `credit_costs` + `platform_settings`, email OTPs, public job board, products, support |
| 021 | `user_oauth_identities` (Google/GitHub sign-in) |
| 022–023 | `wallets`, `credit_transactions` (FIFO credit ledger), credit pack discounts |
| 024 | Career Studio: `talent_passports`, `credentials`, `code_challenges`, `challenge_submissions`, `interview_sessions`, `competency_*` |
| 025 | `resume_uploads` |
| 026 | Enterprise ATS: requisition approvals, `Screened` stage, `crm_pools`, `crm_pool_members`, `outreach_email_*`, `outreach_suppressions` |
| 027 | Statement of work on `proposals` |
| 028 | `deliverable_files` |

> 026 uses `crm_pools` / `outreach_email_campaigns` because 001 already defines the older `talent_pools` / `outreach_campaigns` tables, which `tenants.service.ts` and `seed.mjs` still use.

Key tables from 001:
| Table | Purpose |
|-------|---------|
| `tenants` | Employer orgs |
| `user_accounts` | All users (all roles) |
| `requisitions` | Job openings with SLA tracking |
| `applications` | Candidate→req with stage history JSONB |
| `scorecards` | Panel scores per application |
| `assessment_results` | Sealed IQ/EQ/Grit theta + sten |
| `integrity_queue` | Flagged assessments for review |
| `passports` | Verifiable Talent Passports |
| `certificates` | Digital certificates |
| `projects` | Marketplace projects + milestones JSONB |
| `proposals` | Freelancer bids |
| `ledger_entries` | Financial log |
| `notifications` | User notifications |
| `audit_log` | Admin audit trail |
| `talent_pools` | Saved candidate segments |
| `outreach_campaigns` | Bulk outreach stats |
| `disputes` | Marketplace disputes |
| `consents` | GDPR consent records |
| `refresh_tokens` | JWT refresh token store |

---

## Frontend structure

```
apps/web/src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, globals.css)
│   ├── page.tsx                # Redirects to /platform
│   ├── auth/login/page.tsx     # Login form
│   └── platform/
│       ├── layout.tsx          # AppShell
│       ├── page.tsx            # Role-based redirect
│       ├── requisitions/       # Employer view
│       ├── applications/       # Candidate view
│       ├── passport/           # Talent Passport viewer
│       ├── projects/           # Buyer view
│       └── admin/              # Master control
├── components/
│   ├── layout/                 # AppShell, TopBar, Rail, DashboardRedirect
│   └── ui/                     # Panel, Button, Tag, KPI, Field, etc.
├── lib/api.ts                  # Typed fetch client with auto-refresh
├── store/auth.ts               # Zustand auth store
└── styles/globals.css          # CSS variables + reset
```

Workspaces added since the first cut:

| Route | Who | What |
|-------|-----|------|
| `/platform/wallet` | All | Balance, history, credit packs, Razorpay checkout |
| `/platform/career`, `/career/{resume,challenges,challenges/[id],interview}` | Candidate | Career Studio: résumé upload + AI autofill, code challenges, AI interview |
| `/passport/[slug]` | Public | Shareable talent passport with signed credentials |
| `/platform/hire`, `/hire/{job-creator,approvals,pipeline,pools,outreach}` | Employer / Admin | AI job creator, approvals, Kanban pipeline, Talent CRM, outreach, KPIs |
| `/platform/sourcing`, `/sourcing/{services,orders,orders/[id],contracts,contracts/[id]}` | Buyer / Expert | AI expert search, orders, escrow milestones, deliverables |

Server components fetch public data with `serverGet()` (`src/lib/serverApi.ts`). It uses an in-process cache instead of Next's fetch cache: fresh for `revalidate` seconds, 8 s timeout, and it serves a stale copy for up to 24 h when the API is down. Next 14's fetch-cache revalidation could hang a streamed page when the API was unreachable. The cost is that `/careers` and `/products` now render dynamically.

### Design tokens
All colours/typography are CSS custom properties in `globals.css` matching the original `index.html` design. Components use CSS Modules that reference these variables.

---

## Adding a new backend module

```bash
mkdir apps/api/src/modules/<name>
# Create: <name>.module.ts, <name>.service.ts, <name>.controller.ts
# Register in: apps/api/src/app.module.ts
```

## Adding a new frontend page

1. Create `apps/web/src/app/platform/<slug>/page.tsx`
2. Add `[slug, 'Label']` to the appropriate role in `Rail.tsx`

---

## Environment variables

`apps/api/.env.example` is the full, commented list. These are the groups:

### `apps/api/.env.local`
| Group | Variables |
|-------|-----------|
| Database (required) | `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` or `DATABASE_IAM_AUTH=true` + `AWS_REGION`, `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `DATABASE_MAX_POOL`, `DATABASE_IDLE_TIMEOUT_MS` |
| Voice output (optional) | `VOICE_TTS_ENABLED=false` by default. When enabled, the authenticated API prefers Amazon Polly generative voices (`VOICE_TTS_ENGINE=generative`, the default), then falls back to neural voices for supported locales/regions; use `VOICE_TTS_ENGINE=neural` to skip Generative. Grant the API runtime `polly:DescribeVoices` and `polly:SynthesizeSpeech` in `AWS_REGION`. Only short assistant reply text is sent for synthesis. If disabled or unavailable, the browser uses its best matching on-device voice. |
| Migrations | `migrate.mjs` (run first by `bun run start`) uses the database settings above, or `DATABASE_URL` if set. `DATABASE_MIGRATION_USER` / `DATABASE_MIGRATION_PASSWORD` let it connect as the master user while the app keeps its DML-only user. |
| Auth (required) | `JWT_SECRET` (64+ chars), `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `COOKIE_SECURE`, `COOKIE_DOMAIN`, `TOTP_ENCRYPTION_KEY`, `TRUST_PROXY`, `CORS_ORIGINS` |
| OAuth | `OAUTH_CALLBACK_BASE_URL`, `WEB_APP_URL`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` |
| Payments & credits | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_CREDITS_WEBHOOK_SECRET`, `RAZORPAY_PRO_PLAN_ID` |
| AI | `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL`, `INTERVIEW_MODEL`, `RESUME_MODEL`, `JOB_CREATOR_MODEL`, `AI_SERVICE_URL`, `AI_SERVICE_PUBLIC_URL`, `AI_SERVICE_API_KEY`, `AI_JWT_SECRET`, `AI_TOKEN_TTL_SECONDS`, `ASTEAI_RESULTS_KEY` |
| Credentials | `CREDENTIAL_SIGNING_KEY` (Ed25519), `CREDENTIAL_RETIRED_PUBLIC_KEYS`, `PUBLIC_WEB_URL`, `CERTIFICATE_ASSET_DIR` |
| File storage (S3) | `RESUME_BUCKET`, `RESUME_BUCKET_REGION`, `DELIVERABLE_BUCKET`, `DELIVERABLE_BUCKET_REGION` |
| Email & outreach | `EMAIL_TRANSPORT`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SES_CONFIGURATION_SET`, `EMAIL_WORKER_ENABLED`, `EMAIL_POLL_MS`, `SALES_INBOX`, `SUPPORT_INBOX`, `OUTREACH_DAILY_LIMIT`, `OUTREACH_DISPATCH_ENABLED`, `OUTREACH_DISPATCH_MS`, `OUTREACH_UNSUBSCRIBE_SECRET` |
| Marketplace | `PAYOUT_ENCRYPTION_KEY`, `PAYOUT_MIN`, `INVOICE_ISSUER_NAME/ADDRESS/GSTIN`, `DISPUTE_SWEEP_ENABLED`, `GIG_SWEEP_ENABLED` |
| Sign-up | `TURNSTILE_SECRET_KEY`, `SIGNUP_REQUIRE_OTP` |

### `apps/web/.env.local`
| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Defaults to rewrite → localhost:3001 |
| `NEXT_PUBLIC_WS_URL` | Websocket origin (added to the CSP) |
| `API_INTERNAL_URL` | Server-side API base for `serverGet()` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Sign-up bot check |
| `NEXT_PUBLIC_RESUME_UPLOAD_ORIGIN` | S3 bucket origin added to the CSP so the browser can upload résumés directly |
| `E2E_BASE_URL`, `E2E_PORT` | Playwright only: test an already-running site, or the port for the built-in server (default 3100) |

---

## Testing

| What | Command | Notes |
|------|---------|-------|
| API unit tests | `cd apps/api && bun run test` | node:test + tsx; DB, email and config are faked (`src/test-support/fakes.ts`) |
| Web unit tests | `cd apps/web && bun run test` | Includes contrast tokens, CSP headers, `serverGet` caching |
| Lint / typecheck | `bun run lint`, `bun run typecheck` in each app | |
| Accessibility + CSP e2e | `cd apps/web && bun run build && bun run test:a11y` | Playwright + `@axe-core/playwright` |

The a11y suite (`apps/web/e2e/a11y.spec.ts`) loads `/`, `/for-companies`, `/pricing`, `/jobs` and `/auth/login` in a `light` and a `dark` project. For each, it checks:
- the CSP header is present and the stored theme is applied;
- zero critical or serious axe violations (WCAG 2.0/2.1 A + AA, including contrast and ARIA);
- zero CSP violations (a `securitypolicyviolation` listener plus console messages).

It starts `next start` on port 3100 by itself, and the API doesn't need to be running (pages fall back gracefully). Playwright is pinned to 1.63.0 to match the cached Chromium build; run `bunx playwright install chromium` on a fresh machine or in CI.

---

## Deployment

### AWS RDS
- RDS is PostgreSQL 16 with `rds.force_ssl=1` and IAM auth (see `infra/`). The API uses `DATABASE_SSL=true` (+ `DATABASE_IAM_AUTH=true` for token auth).
- **Migrations run as the master user, not the app user.** They create extensions (`uuid-ossp`), types and tables; the app's IAM user needs only DML + SELECT.
- `migrate.mjs` connects the same way the API does: the `DATABASE_*` settings, including IAM tokens and SSL. Set `DATABASE_MIGRATION_USER=asteai_root` to run as the master user; leave `DATABASE_MIGRATION_PASSWORD` blank to use an IAM token. A `DATABASE_URL`, if set, takes precedence. In the URL, use `sslmode=verify-full&sslrootcert=<RDS CA bundle>`, because recent `pg` treats `sslmode=require` as `verify-full`.
  ```bash
  bun run --filter @asteai/db migrate:status   # then: migrate
  ```
- If the infra `null_resource` already applied `001_initial_schema.sql` by hand, first insert `001_initial_schema.sql` into `schema_migrations` so the runner skips it.
- `bun run start` in `apps/api` runs `migrate` before booting, so a container with the migration user set migrates on deploy. Runs are serialised by a Postgres advisory lock: when several tasks start at once, one applies the files and the others wait, then find nothing pending.

### NestJS (ECS / PM2)
```bash
bun run build   # → dist/
bun run start   # node dist/main.js
```

### Next.js (Vercel / ECS)
```bash
bun run build
bun run start
```
Remove the dev rewrite in `next.config.js`; configure nginx/ALB to route `/api/v1/*` to the NestJS service.

---

## Roadmap — connecting to deeptech_ai

1. **IRT scoring** — wire `AssessmentsService` to deeptech_ai for Rasch/3PL theta estimation
2. ~~**AI job creator**~~ — done (`job-creator` module)
3. **Candidate matching** — pgvector similarity search on passports (AI expert search ranks with the LLM today)
4. **Voice studio** — real-time STT/TTS during assessments (the interview studio has a turn-based voice mode)
5. **Marketing Studio** — Meta Ads campaign builder (full logic in `index.html` → migrate to dedicated module)
