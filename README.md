# Patungan — Frontend

Responsive web app for a treasurer collecting contributions from high-school friends toward wedding gifts.
React 19 · Vite · TypeScript · React Router · TanStack Query · Tailwind CSS v4. All user-facing copy is in Indonesian.

The backend (FastAPI + PostgreSQL) lives in a separate repository (`patungan-service`). This app talks to it only over
HTTP; it never connects to the database.

## Features

| Route | Access | What it does |
|---|---|---|
| `/login` | public | Treasurer login (no sign-up) |
| `/` | treasurer | Dashboard: active events, participants, total collected/pending, recent events |
| `/events` | treasurer | Event list with status filter, title search, pagination, create event |
| `/events/:id` | treasurer | Event detail: summary, progress, participants, add/edit/remove contributions, mark paid/unpaid, edit/delete event, copy public link, copy WhatsApp summary |
| `/friends` | treasurer | Master friend list: search, pagination, create, edit, delete (when the backend allows it) |
| `/public` | anyone | Read-only list of public events |
| `/public/events/:id` | anyone | Read-only public event page (the link the treasurer shares) |

## Local setup

Requirements: Node.js ≥ 22.22 (required by React Router 8), npm.

```bash
npm install
cp .env.example .env      # adjust VITE_API_BASE_URL if needed
npm run dev               # http://localhost:5173
```

Start the backend separately (see its README). Its `CORS_ORIGINS` must include the frontend origin, e.g.
`http://localhost:5173`. The treasurer account is created on the backend with `python -m app.cli create-treasurer`.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend base URL **including** the `/api/v1` prefix |

`VITE_*` variables are inlined at build time, so set it before `npm run build`. Never put secrets in them.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc --noEmit`) and production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm test` | Run the test suite once (Vitest + Testing Library, jsdom) |
| `npm run test:watch` | Tests in watch mode |

The app uses client-side routing; configure the production host to serve `index.html` for unknown paths.

## Project structure

```
src/
  components/ui/       Button, Card, StatCard, Badge, form fields, Dialog/ConfirmDialog, Toast, DataTable, Pagination…
  components/layout/   Authenticated and public layouts
  features/auth/       AuthProvider, useAuth, ProtectedRoute
  features/events/     Event/contribution query hooks, dialogs, summary panel, participants table
  features/friends/    Friend query hooks and form dialog
  features/public/     Public (unauthenticated) query hooks
  pages/               Route components
  services/            apiClient (the only place that calls fetch), per-resource services, errors, session, query keys
  hooks/               Debounce, clipboard, URL search-param state
  types/api.ts         Request/response types mirroring the backend Pydantic schemas
  utils/               Rupiah/date formatting, validation, WhatsApp text, labels
```

## API integration

Types in `src/types/api.ts` were written against the backend source (`app/schemas/*.py`, `app/api/v1/*.py`), not
guessed. Key points of the contract:

- Lists return `{items, total, page, page_size}`; `page_size` max 100.
- Errors are always `{"error": {"code", "message", "details"}}`. `services/errors.ts` turns them into `ApiError`
  and maps codes (`invalid_credentials`, `not_found`, `duplicate_contribution`, `friend_in_use`, `validation_error`…)
  to Indonesian messages. Network failures become `NetworkError`.
- Money is integer Rupiah. All totals, counts, `paid_at` and `progress_percent` come from the backend. The frontend
  only formats them.
- New contributions are created without a status, and the backend sets them to `pending`. Changing the amount or the
  notes never changes the status.

### TanStack Query

- Query keys are hierarchical (`services/queryKeys.ts`).
- After any contribution mutation, both the event's participant list and `GET /events/{id}/summary` are invalidated,
  so totals, counts and progress always reflect the backend. A status update also writes the returned row (with
  `paid_at`) into the cache straight away.
- Event edits update the detail cache and invalidate event lists and the summary, because `target_amount` drives
  `progress_percent`.
- Client errors (4xx) are not retried. Network errors and 5xx are retried twice.

### Contract gaps and how the frontend handles them

| Spec asks for | Backend reality | Frontend behaviour |
|---|---|---|
| Dashboard totals from backend | No aggregate/dashboard endpoint | Loads every event (all pages) and every event's backend `/summary`, then adds them up. Figures appear only after **all** summaries have loaded. They are never shown from a partial set. **Recommended:** add `GET /dashboard/summary`. |
| Event list shows participants and collected amount | `EventRead` has no such fields | One `/events/{id}/summary` request per visible row (≤10 per page). **Recommended:** embed summary fields in the list response. |
| Event search | `GET /events` supports `status` only | The title search filters only the page currently shown, and the UI says so. **Recommended:** add a `search` query param. |
| Contribution list pagination | Paginated, max 100 | Event detail loads all pages, which is bounded because a friend can join an event only once. The paid/pending filter is applied in the browser. Counts and totals still come from the summary. |
| Secure cookie session | Bearer JWT in the response body. CORS `allow_credentials=False` | See Authentication below. |
| Public payment amounts | `PublicParticipant` exposes `name` and `payment_status` only | The public page shows only those, plus aggregate totals from the public summary. |

## Authentication

- `POST /auth/login` returns a short-lived JWT (`expires_in` seconds, 60 minutes by default). The backend does not
  support cookies, so the frontend uses the documented Bearer flow.
- The token and its expiry are stored in **`sessionStorage`**. This storage belongs to one tab and is cleared when the
  tab closes. Nothing goes in `localStorage`, and the password is never stored. The token is sent only on management
  requests. Public endpoints are called with `auth: false` and `credentials: 'omit'`.
- Any 401 on an authenticated request clears the session and the query cache, and redirects to `/login`. The user
  returns to the page they wanted after logging in. Only same-app paths are accepted as the return target. A wrong
  password (401 on login) shows an error and does not trigger this flow.
- Trade-off: any token readable by JavaScript can be stolen through XSS. React escapes rendered output, and the app
  uses no `dangerouslySetInnerHTML`. For stronger protection, the backend could issue an HttpOnly, Secure,
  SameSite cookie, which would also need CSRF protection and `allow_credentials=True`.
- `ProtectedRoute` is a UX guard only. Authorization is enforced by the backend on every protected endpoint.

## Privacy on public pages

Public pages call `/public/*` only. They render event title, description, date, status, target, participant names with
their payment status, and aggregate totals. They do not show phone numbers, nicknames, notes, individual amounts or
payment timestamps, because the API does not return them. Private events (`is_public=false`) return 404 and are shown as
"Acara tidak tersedia". The treasurer sees a warning in the event form that public events reveal participant names and
payment status to anyone who has the link.

## Tests

`npm test` runs the following suites. `fetch` is stubbed with a routing table in `src/test/utils.tsx`, so no backend is
needed:

- **Auth:** validation, wrong credentials, successful login with redirect, return to the requested page, the token as
  the only thing stored, a 401 clearing the session, logout, dashboard totals
- **Public pages:** no auth header and only `/public/*` calls, read-only UI, unavailable state for private or missing
  events, empty state
- **Events:** loading, error and empty states, status filter, create event with validation, edit event, not-found event
- **Contributions:** add a participant (validation, duplicate 409), mark as paid with list and summary invalidation,
  confirmation before reverting a payment, edit amount and notes, remove with confirmation
- **Friends:** list, empty state, server search, create with validation, edit, `friend_in_use` explanation, delete
- **Utilities:** Rupiah, date and WIB datetime formatting, amount input parsing, the API client, WhatsApp text

## Status and backend dependencies

The frontend is implemented and tested against mocked responses that match the backend schemas. It has **not yet been
verified end-to-end against a running backend.** To do that, start the backend with a migrated database and a
treasurer account, set `CORS_ORIGINS`, then log in and go through each flow.
