# Project context

## What this is

Patungan ("chip in together") is a web app for a **treasurer** who collects money from high-school friends toward
wedding gifts. The treasurer keeps a list of friends, creates an *event* per gift, adds friends to the event with an
amount each, marks who has paid, and shares a read-only link so friends can see progress.

This repository is the **frontend only**. The backend is a separate service reached over HTTP. Its source code is not
part of this repository and is not assumed to be available; everything documented here about the backend is derived
from this repository (service functions, TypeScript types, tests, README).

## Users and access

| Actor | Authenticated | Can do |
|---|---|---|
| Treasurer | Yes (email + password, Bearer token) | Everything below |
| Friend / anyone with a link | No | View public event pages, read-only |

There is exactly one application user role (the treasurer). There is no sign-up page and friends do not have accounts.

## Scope

The treasurer can: log in; manage the master list of friends; create, edit, delete events; add friends to events with a
contribution amount; mark contributions paid or pending; edit contribution amount and notes; remove contributions;
review financial summaries; copy the public event link; copy a WhatsApp-ready summary.

Out of scope for this repo: backend code, database configuration, user registration, password reset, payments
processing (the app records payments, it does not take them).

## Pages and routes

Route paths are English; visible text is Indonesian.

| Path | Access | Page component | Purpose |
|---|---|---|---|
| `/login` | public | `LoginPage` | Treasurer login |
| `/` | treasurer | `DashboardPage` | Active events, participants, totals, recent events |
| `/events` | treasurer | `EventsPage` | Event list: status filter, per-page title search, pagination, create |
| `/events/:eventId` | treasurer | `EventDetailPage` | Event info, summary, participants, all contribution actions, edit/delete event, share |
| `/friends` | treasurer | `FriendsPage` | Master friends: search, pagination, create/edit/delete |
| `/public` | anyone | `PublicEventsPage` | List of public events |
| `/public/events/:eventId` | anyone | `PublicEventPage` | Read-only event page (the shareable link) |
| `*` | anyone | `NotFoundPage` | 404 |

Query-string state: `?page=`, `?status=` (events), `?search=` (friends), `?new=1` (opens the create-event dialog).
Pages under `/` other than `/login` and `/public/**` are wrapped by `ProtectedRoute`.

## Glossary (UI term → meaning)

| Indonesian (UI) | Meaning |
|---|---|
| Bendahara | Treasurer |
| Acara | Event (one gift collection) |
| Teman | Friend (master record) |
| Peserta | Participant (a friend's contribution within an event) |
| Iuran | A contribution / its amount |
| Lunas | Paid |
| Belum bayar | Pending (not yet paid) |
| Terkumpul | Collected (paid amount) |
| Belum masuk | Not yet received (pending amount) |
| Publik / Privat | Public / private visibility |
| Aktif / Selesai | Event status `active` / `completed` |
| Dasbor | Dashboard |

## Domain model (as seen by the frontend)

Defined in `src/types/api.ts`.

- **Friend**: `id`, `name`, `nickname | null`, `phone | null`, `created_at`. Reused across events.
- **Event**: `id`, `title`, `description | null`, `event_date | null`, `target_amount | null`,
  `status` (`active` | `completed`), `is_public`, `created_by`, timestamps.
- **Contribution** (a friend's participation in one event): `id`, `event_id`, `friend_id`, embedded
  `friend {id, name, nickname}`, `amount`, `payment_status` (`pending` | `paid`), `paid_at | null`, `notes | null`,
  timestamps.
- **EventSummary**: aggregates computed by the backend: `total_participants`, `paid_count`, `pending_count`,
  `total_collected`, `total_pending`, `target_amount`, `progress_percent | null`.
- **Public types**: `PublicEvent`, `PublicParticipant {name, payment_status}`, `PublicEventDetail`.

All money is integer Rupiah.

## Environment and running

See [README.md](../README.md) for setup. Key facts:

- Node.js >= 22.22 (declared in `package.json` `engines`).
- API base URL comes from `VITE_API_BASE_URL` (must include the API prefix, e.g. `.../api/v1`). `.env` is git-ignored;
  `.env.example` is the template.
- The backend must allow the frontend origin for cross-origin requests and accept a `Authorization: Bearer <token>`
  header. The frontend sends requests with `credentials: 'omit'` (no cookies).

## Status and known gaps

- Implemented: all pages above, with loading, empty, error and validation states, and 50 automated tests.
- **Not verified against a running backend.** Tests use mocked `fetch`.
- **Default API URL mismatch**: `src/services/config.ts` defaults to `<protocol>//<hostname>:8001/api/v1`, while
  README and `.env.example` say `http://localhost:8000/api/v1`. One test (`apiClient.test.ts`, URL building) fails
  because of it. Align them once the intended port is decided.
- **Backend contract gaps worked around in the UI** (see [API_CONVENTIONS.md](API_CONVENTIONS.md#contract-gaps-and-workarounds)):
  no dashboard aggregate endpoint, no per-event totals in the event list, no event text search.
- Old Indonesian URLs (`/masuk`, `/acara`, `/teman`, `/publik`) no longer exist; links shared with the old
  `/publik/acara/:id` format will land on the 404 page.

## Document map

- [BUSINESS_RULES.md](BUSINESS_RULES.md): the rules the UI must respect.
- [ARCHITECTURE.md](ARCHITECTURE.md): structure, routing, auth, data flow, UI building blocks.
- [API_CONVENTIONS.md](API_CONVENTIONS.md): endpoints, types, errors, how to add an API call.
- [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md): workflow, style, testing, definition of done.
