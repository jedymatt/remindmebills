# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Remind Me Bills — a Next.js full-stack app for tracking bills and recurring payments. Built with the T3 stack (create-t3-app). Uses MongoDB, tRPC, Better Auth, and React Query.

## Commands

```bash
pnpm dev              # Dev server with Turbopack
pnpm build            # Production build
pnpm check            # Lint + typecheck (run before committing)
pnpm lint             # ESLint only
pnpm lint:fix         # ESLint with auto-fix
pnpm typecheck        # TypeScript type checking only
pnpm format:check     # Prettier check
pnpm format:write     # Prettier auto-format
```

No test framework is configured.

## Architecture

### Tech Stack
- **Framework:** Next.js 16 (App Router, RSC)
- **Language:** TypeScript (strict mode), path alias `~/` → `src/`
- **API:** tRPC 11 with SuperJSON transformer — type-safe end-to-end RPC
- **Database:** MongoDB (native driver, no ORM) — database name: `main`
- **Auth:** Better Auth with Google OAuth + anonymous sign-in
- **State:** TanStack React Query (via tRPC bindings), React Hook Form + Zod
- **UI:** Shadcn/ui (New York style) + Radix UI + Tailwind CSS 4 + Lucide icons
- **Env validation:** `@t3-oss/env-nextjs` in `src/env.js`

### Key Directories
- `src/app/` — Next.js App Router pages and layouts
- `src/server/api/routers/` — tRPC routers (`bill`, `income`, `post`)
- `src/server/api/trpc.ts` — tRPC initialization, context, `publicProcedure`/`protectedProcedure`
- `src/server/api/root.ts` — tRPC app router combining all sub-routers
- `src/server/auth/` — Better Auth configuration
- `src/server/db/` — MongoDB client (singleton, cached in dev via `globalThis`)
- `src/trpc/` — Client-side tRPC setup (`react.tsx` for React Query, `server.ts` for RSC)
- `src/components/ui/` — Shadcn/ui components
- `src/lib/` — Shared utilities (auth client, utils)

### API Pattern (tRPC)
- Routers live in `src/server/api/routers/`. Each exports a router created with `createTRPCRouter`.
- Use `protectedProcedure` for authenticated endpoints; it guarantees `ctx.session.user` is non-null.
- Use `publicProcedure` for unauthenticated endpoints.
- The app router in `src/server/api/root.ts` merges all sub-routers — new routers must be added there.
- Client calls: `api.<router>.<procedure>.useQuery()` / `.useMutation()` via React Query hooks.
- Server calls (RSC): use the caller from `src/trpc/server.ts`.

### Auth
- Better Auth configured in `src/server/auth/config.ts` with MongoDB adapter.
- Providers: Google OAuth, anonymous sign-in (guest mode).
- Route protection via Next.js middleware in `src/proxy.ts` — checks session for `/dashboard`.
- Client auth: `src/lib/auth-client.ts` exports `authClient` with `signIn`, `signOut`, `useSession`.

### Forms & Validation
- React Hook Form with Zod schemas. Use `useWatch` (not `form.watch`) for reactive field watching.
- Bill creation uses a Zod discriminated union: single bills (with `date`) vs recurring bills (with `recurrence` using rrule).

### Environment Variables
Required: `MONGODB_URI`, `BETTER_AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. `BETTER_AUTH_SECRET` is required in production. Set `SKIP_ENV_VALIDATION=1` to bypass validation (useful for Docker builds).
