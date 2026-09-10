---
name: verify
description: Build/launch/drive recipe for verifying changes in the running Remind Me Bills app.
---

# Verify: Remind Me Bills

## Launch

```bash
pnpm dev --port <port>   # Turbopack; up in ~7s. Needs MONGODB_URI etc. in .env
curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/   # 200 when ready
```

## Getting a session (no OAuth needed)

Protected routes (`/dashboard`, `/bills/*`, `/playground`) 307-redirect to `/`
without a session. On the landing page click **"Try as Guest"** — anonymous
Better Auth sign-in, cookie-based, works headlessly via Playwright.

## Flows worth driving

- **Income profile** (first-run gate): `/dashboard` shows the setup form until
  a profile exists — pay frequency select + `DatePicker` (Calendar popover).
  The playground refuses to load without it.
- **Bill create**: `/bills/create` — `BillFormFields` ("Once" date, "Repeating"
  dtstart/until `DateInput`s). Until input stays disabled until its radio is
  picked.
- **Bill edit**: click a bill row on `/dashboard` → details dialog → Edit —
  same `BillFormFields` seeded from server `Date`s.

## Gotchas

- Date fields are native `<input type="date">` — Playwright `fill` with
  `"yyyy-MM-dd"` works.
- Guest data persists in MongoDB per anonymous user; each fresh browser
  context starts clean.
- Expected noise: Radix "Missing Description for DialogContent" browser
  warnings. Pre-existing.
