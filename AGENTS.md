# VozIA — Agent Guide

## Project

Multi-tenant SaaS for AI voice agents. **Telnyx** (voice/streaming) + Gemini Live (conversation) + Whop (payments).

## Architecture

- **Frontend**: Next.js 16 (standalone), Tailwind 4, shadcn/ui, Zustand — port 3000
- **Backend**: Express (Bun) — port 3001 — WebSockets, SSE, webhooks, billing, monitoring
- **DB**: PostgreSQL 17 + pgvector + Redis 7 (via `docker compose up -d`)
- **ORM**: Prisma — single `prisma/schema.prisma` shared by both packages

## Dev Commands

| Command | What |
|---|---|
| `npm run dev` | Frontend only (port 3000) |
| `npm run dev:backend` | Backend only (port 3001) |
| `npm run dev:all` | Both concurrently |
| `npm run build` | `prisma generate && next build` |
| `npm run db:seed` | `npx tsx prisma/seed.ts` (solo config base + paquetes) |
| `npm run db:seed:demo` | `SEED_DEMO=true npx tsx prisma/seed.demo.ts` (cuentas demo) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run docker:up` | `docker compose up -d` (Postgres + Redis) |

Backend commands (inside `backend-express/`):
| `bun dev` | Dev with hot reload |
| `npm run build` | `npx tsc` (CommonJS output to `dist/`) |
| `npm run lint` | `npx tsc --noEmit` |

## Backend API (Express, port 3001)

- `GET /health` — health check
- `POST /webhooks/telnyx/voice` — Telnyx voice webhook
- `POST /webhooks/whop` — Whop payment webhook
- `/internal/*` — internal API (auth required)
- `/admin/*` — admin API
- `GET /sse/events?user_id=...&token=...` — Server-Sent Events
- `WS /stream/telnyx` — WebSocket for Telnyx Stream

## Key conventions

- **ESLint is permissive** — most rules off (no-explicit-any, no-unused-vars, etc.)
- **noImplicitAny: false** in frontend tsconfig
- **Backend uses CommonJS** (`module: "commonjs"`), runs via **Bun** in dev
- **Frontend uses ESM** (Next.js default), path alias `@/` → `src/`
- **Seed script requires Bun**: `bun prisma/seed.ts` (not `npx ts-node`)
- **Build order matters**: `prisma generate` must run before `next build`
- **Standalone output**: Next.js produces `.next/standalone/` for deployment
- **Shared Prisma schema**: `prisma/schema.prisma` is also referenced from `backend-express/` via relative path
- **Backend env vars in root `.env`** are shared; backend uses `dotenv/config`
- **Rate limiting** applied globally via Express middleware
- **Logging**: pino logger with structured logs

## Required env vars (see `.env.example`)

Database, Redis, Gemini API key, **Telnyx** credentials, Whop, Cloudflare R2, JWT secrets, SMTP, domain config.
