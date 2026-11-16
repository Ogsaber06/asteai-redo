# AsteAI Platform

Multi-sided AI hiring and talent marketplace. NestJS API + Next.js 14 frontend, AWS RDS (PostgreSQL), Bun monorepo.

## Quick start

```bash
bun install

# Copy and fill .env files
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local

# Dev servers (the API auto-runs pending DB migrations before startup)
bun run dev:api   # :3001
bun run dev:web   # :3000

# Optional: run migrations manually at any time
DATABASE_URL=postgres://... bun run --filter @asteai/db migrate
```

Swagger: http://localhost:3001/api/docs

## Checks

```bash
cd apps/api && bun run test && bun run lint && bun run typecheck
cd apps/web && bun run test && bun run lint && bun run typecheck && bun run build
cd apps/web && bun run test:a11y   # Playwright + axe: 5 public pages × light/dark, after build
```

## What's in it

- **Auth:** HttpOnly cookie sessions, Google/GitHub OAuth, OTP sign-up, 2FA.
- **Credits & wallet:** FIFO credit ledger, Razorpay packs and Pro plan, metered AI endpoints with automatic refunds.
- **Career Studio:** résumé upload + AI autofill, code challenges (Judge0), AI interview studio, signed credentials, public `/passport/[slug]`.
- **Hire (ATS):** AI job creator, requisition approvals, pipeline, Talent CRM pools, bulk outreach, hiring KPIs.
- **Sourcing:** AI & voice expert search, services and orders, SOW proposals, milestone escrow with disputes, deliverable uploads.

## Structure

```
apps/api   → NestJS REST API
apps/web   → Next.js 14 frontend
packages/
  types    → Shared TypeScript types
  db/      → SQL migrations 001–028 (migrate.mjs)
apps/web/e2e → Playwright accessibility + CSP suite
docs/      → ARCHITECTURE.md, ASTEAI_REDO_SPEC.md, CLEANUP.md
infra/     → OpenTofu for RDS + IAM
legacy/    → previous single-file HTML prototype (reference only)
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full developer guide.

## Roles

Employer · Candidate · Freelancer · Buyer · Admin

## Prior art

Rewrite of `deeptech_backend` (Express) + `deeptech_frontend` (React SPA).  
Connects to `deeptech_ai` for IRT scoring, translation, and LLM features.
