# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Remind Me Bills — a Next.js full-stack app for tracking bills and recurring payments. Built with the T3 stack (create-t3-app). Uses MongoDB, tRPC, Better Auth, and React Query.

## Commands

```bash
pnpm dev              # Dev server with Turbopack
pnpm build            # Production build
pnpm preview          # Build + start production server locally
pnpm check            # Typecheck + lint + tests (run before committing)
pnpm lint             # ESLint only
pnpm lint:fix         # ESLint with auto-fix
pnpm typecheck        # TypeScript type checking only
pnpm format:check     # Prettier check
pnpm format:write     # Prettier auto-format
```

```bash
pnpm test             # Vitest run (pure helpers in `src/**/*.test.ts`)
pnpm test:watch       # Vitest watch mode
```

Vitest covers pure helpers only — there is no harness for tRPC routers or
components, so router logic is verified by review and by hand (tracked in #47).

`pnpm check` runs the three gates in order — `pnpm typecheck && pnpm lint &&
pnpm test` — so the fastest decisive signal comes first. It delegates to those
three scripts rather than inlining the tools because CI runs the same three as
separate parallel jobs; sharing one definition per gate keeps them from
drifting. Lint is ratcheted at `--max-warnings 0`. Note that Next 16 removed
`next lint`, so ESLint is invoked directly; `eslint-config-next` must stay in
lockstep with `next`, and its flat config is consumed via its native
`eslint-config-next/core-web-vitals` entrypoint (no `FlatCompat` shim).

## Architecture

### Tech Stack

- **Framework:** Next.js 16 (App Router, RSC)
- **Language:** TypeScript (strict mode), path alias `~/` → `src/`
- **API:** tRPC 11 with SuperJSON transformer — type-safe end-to-end RPC
- **Database:** MongoDB (native driver, no ORM) — database name: `main`
- **Auth:** Better Auth with Google OAuth + anonymous sign-in
- **State:** TanStack React Query (via tRPC bindings), React Hook Form + Zod
- **UI:** Shadcn/ui (New York style) + Radix UI + Tailwind CSS 4 + Lucide icons + Sonner (toasts)
- **Env validation:** `@t3-oss/env-nextjs` in `src/env.js`

### Key Directories

- `src/app/` — Next.js App Router pages and layouts
- `src/server/api/routers/` — tRPC routers (`bill`, `bnpl`, `group`, `income`, `payment`, `post`)
- `src/server/api/trpc.ts` — tRPC initialization, context, `publicProcedure`/`protectedProcedure`
- `src/server/api/root.ts` — tRPC app router combining all sub-routers
- `src/server/auth/` — Better Auth configuration
- `src/server/db/` — MongoDB client (singleton, cached in dev via `globalThis`)
- `src/trpc/` — Client-side tRPC setup (`react.tsx` for React Query, `server.ts` for RSC)
- `src/components/ui/` — Shadcn/ui components
- `src/components/` — Domain components (BillFormFields, BillModal, CreateBillForm, PlaygroundWorkspace, etc.)
- `src/app/_components/` — Shared RSC components (billList, post)
- `src/types/` — Domain types: `BillEvent`, `PlaygroundBill`, `IncomeProfile`, `Recurrence`
- `src/lib/` — Shared utilities (auth client, utils)
- `src/lib/bill-utils.ts` — Recurrence helpers using rrule (pay rules, bill scheduling)

### Routes

- `/` — Home/landing page
- `/dashboard` — Main bill dashboard (protected)
- `/bills/create` — Create bill form (protected)
- `/groups` — Bill group management (protected)
- `/bnpl` — BNPL account management: accounts, purchases, statement settling (protected)
- `/playground` — Guest-accessible demo area with local-only bill state

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
- Route protection via Next.js middleware in `src/proxy.ts` — checks session for `/dashboard`, `/playground`, `/groups`, and `/bnpl`. Uses optimistic redirect (not fully secure per Better Auth docs) — handle auth checks in individual pages too.
- Client auth: `src/lib/auth-client.ts` exports `authClient` with `signIn`, `signOut`, `useSession`.

### Forms & Validation

- React Hook Form with Zod schemas. Use `useWatch` (not `form.watch`) for reactive field watching.
- Bill creation uses a Zod discriminated union: single bills (with `date`) vs recurring bills (with `recurrence` using rrule).

### Environment Variables

Required: `MONGODB_URI`, `BETTER_AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. `BETTER_AUTH_SECRET` is required in production. Set `SKIP_ENV_VALIDATION=1` to bypass validation (useful for Docker builds).
