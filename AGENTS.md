# AGENTS.md

Instructions for any AI coding agent (and human) working in this repository.

**Patungan** is the frontend of a small web app that lets one treasurer collect contributions from friends toward
wedding gifts. It is a React + Vite + TypeScript single-page app that talks to a separately maintained HTTP backend.
This repository contains **only the frontend**.

## Read before you change anything

Do not start editing until you have read the documents that match your task.

| If your task involves… | Read first |
|---|---|
| Anything (first time in this repo) | [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) |
| Money, payment status, participants, privacy, validation limits, formatting | [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) |
| New pages/routes, folders, providers, auth/session, caching, query invalidation, UI components | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Endpoints, request/response types, error handling, adding or changing an API call | [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md) |
| Code style, naming, copy/i18n, accessibility, tests, definition of done | [docs/DEVELOPMENT_GUIDELINES.md](docs/DEVELOPMENT_GUIDELINES.md) |

[README.md](README.md) covers local setup and scripts. If a document disagrees with the code, **the code wins**:
verify, then fix the document in the same change.

## Commands

Requires Node.js >= 22.22 and npm.

```bash
npm install
npm run dev          # Vite dev server, http://localhost:5173
npm run typecheck    # tsc --noEmit
npm test             # Vitest, single run (fetch is mocked; no backend needed)
npm run build        # tsc --noEmit && vite build
```

Run `npm run typecheck`, `npm test` and `npm run build` before declaring work finished, and report their real results.

## Non-negotiable rules

1. **Frontend only.** Never add backend code, database access or database configuration here. The app must not
   connect to a database.
2. **The backend is the source of truth for money.** Totals, counts, `paid_at`, `payment_status` and
   `progress_percent` come from API responses. Never calculate, derive or persist authoritative balances in the
   frontend. See [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).
3. **All HTTP goes through `src/services/apiClient.ts`.** No raw `fetch` in components, hooks or pages. Components
   use query/mutation hooks from `src/features/*`, which call `src/services/*`.
4. **Do not invent API shapes.** Types live in `src/types/api.ts`. If you need a field or endpoint that is not
   there, say so and ask or document the assumption; do not guess. See [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md).
5. **Public pages use `/public/*` endpoints only**, never send the auth token, and render only fields the public
   types define. Never show phone numbers, notes, per-person amounts or management actions there.
6. **Never store credentials.** The password is never persisted. The access token lives only in JavaScript memory;
   the refresh token is managed by the backend in an HttpOnly cookie. Never put either token in browser storage.
7. **User-facing text is Indonesian. Code, identifiers, comments, routes and docs are English.**
8. **No `any`** unless there is a documented reason in a comment. No new dependency without a clear reason.
9. **Client-side route guards are UX only.** Authorization is enforced by the backend. Never rely on
   `ProtectedRoute` for security.
10. **Destructive actions need a confirmation dialog** (`ConfirmDialog`).

## Conventions in one glance

- Import alias: `@/` maps to `src/`.
- Routes (English): `/login`, `/`, `/events`, `/events/:eventId`, `/friends`, `/public`, `/public/events/:eventId`.
- Server state: TanStack Query only. Query keys come from `src/services/queryKeys.ts`. After a mutation, invalidate
  every query derived from the changed data (see the invalidation table in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- Styling: Tailwind CSS v4 utility classes, neutral (stone) backgrounds, green accents. Reuse `src/components/ui/*`.
- Tests sit next to the code they cover (`*.test.ts(x)`); API calls are mocked with `mockApi` in `src/test/utils.tsx`.

## Known issues (as of the last documentation update)

- **API base URL default mismatch.** `src/services/config.ts` falls back to
  `<current protocol>//<current hostname>:8001/api/v1` when `VITE_API_BASE_URL` is unset, but `README.md` and
  `.env.example` still say `http://localhost:8000/api/v1`. Set `VITE_API_BASE_URL` explicitly in `.env`.
  - **API port mismatch remains in setup docs:** the code and URL test use port 8001 while README and `.env.example`
    say port 8000. Set `VITE_API_BASE_URL` explicitly until the intended default is decided.
  - **Refresh backend contract not verified.** The previous repository-derived contract did not describe refresh,
    logout or credentialed cookies. The frontend implementation follows `docs/AUTHENTICATION.md` assumptions and has
    only been tested with mocked responses.
  - The frontend test suite currently has 51 passing tests; it has not been exercised against a live backend.
- **Not verified end-to-end.** The app has only been tested against mocked responses, not a running backend.

When you fix or discover an issue, update this list.

## Keeping docs current

Update the relevant file in `docs/` in the same change when you alter: routes, folder structure, API calls or types,
cache/invalidation behaviour, validation limits, formatting rules, or any rule in `BUSINESS_RULES.md`.
