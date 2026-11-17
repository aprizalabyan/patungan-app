# Project context

## What this is

Patungin Aja is a web app for managing and recording contributions or shared expenses for an event. The treasurer
keeps a list of participants, creates an *event*, adds participants with their contribution amounts, marks who has
paid, and can share a read-only link so others can see progress.

This repository is the **frontend only**. The backend is a separate service reached over HTTP. Its source code is not
part of this repository and is not assumed to be available; everything documented here about the backend is derived
from this repository (service functions, TypeScript types, tests, README).

## Users and access

| Actor | Authenticated | Can do |
|---|---|---|
| Treasurer | Yes (email + password, memory access token + HttpOnly refresh cookie) | Everything below |
| Friend / anyone with a link | No | View public event pages, read-only |

There is exactly one application user role (the treasurer). There is no sign-up page and friends do not have accounts.

## Scope

The treasurer can: log in; manage the master list of friends; create, edit, delete events; choose `track_status` or
`paid_only` payment mode; add friends to events with a contribution amount; manage payment accounts (bank / e-wallet)
and choose which ones an event accepts; record payments immediately in `paid_only`, or record/cancel the single payment
later in `track_status` (the payment always equals the bill); edit pending contribution amounts and notes, and edit
paid `paid_only` amounts with confirmation or change their destination account while retaining payment status, date and history;
remove contributions that were never paid; review financial summaries including receipts per account; copy the public event link; copy a WhatsApp-ready summary.

Out of scope for this repo: backend code, database configuration, user registration, password reset, payments
processing (the app records payments, it does not take them).

## Pages and routes

Route paths are English; visible text is Indonesian.

| Path | Access | Page component | Purpose |
|---|---|---|---|
| `/login` | public | `LoginPage` | Treasurer login |
| `/` | treasurer | `DashboardPage` | Active events, participants, totals, recent events |
| `/events` | treasurer | `EventsPage` | Event list: status filter, per-page title search, pagination, create |
| `/events/:eventId` | treasurer | `EventDetailPage` | Event info, summary with receipts per account, event payment accounts, participants, payment dialog, edit/delete event, share |
| `/friends` | treasurer | `FriendsPage` | Master friends: search, pagination, create/edit/delete |
| `/payment-accounts` | treasurer | `PaymentAccountsPage` | Global payment accounts: list, create, edit, activate/deactivate (no delete) |
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
| Lunas | Paid (the contribution has its one payment) |
| Belum bayar | Pending (no payment recorded) |
| Terkumpul / Diterima | Received (sum of the bills of paid contributions) |
| Belum masuk / Belum dibayar | Still owed (bills of pending contributions) |
| Rekening | Payment account (bank or e-wallet) |
| Publik / Privat | Public / private visibility |
| Aktif / Selesai | Event status `active` / `completed` |
| Dasbor | Dashboard |

## Domain model (as seen by the frontend)

Defined in `src/types/api.ts`.

- **Friend**: `id`, `name`, `nickname | null`, `phone | null`, `created_at`. Reused across events.
- **Event**: `id`, `title`, `description | null`, `event_date | null`, `target_amount | null`,
  `status` (`active` | `completed`), `payment_mode` (`paid_only` | `track_status`), `is_public`, `created_by`, timestamps.
- **Contribution** (a friend's participation in one event): `id`, `event_id`, `friend_id`, embedded
  `friend {id, name, nickname}`, `amount` (the bill), `payment_status` (`pending` | `paid`, set by the backend),
  `paid_at | null`, `payment_account` (snapshot taken when paid; `null` while pending and for legacy paid data),
  `payment_notes | null`, `notes | null`, timestamps. The payment lives on the contribution; there is no payment list.
- **PaymentAccount**: `id`, `type` (`bank` | `e_wallet` | `cash`), `provider_name` (free text; always `Cash` for cash), `account_name`, `account_number` (`null` for cash)
  (string), `label | null`, `is_active`, timestamps. Owned by the treasurer, global, never deleted.
- **EventSummary** (treasurer): backend aggregates: `total_contributions`, `total_received`, `payment_accounts[]`,
  `unassigned_total`, plus the public eight (`PublicEventSummary`: `paid_count`, `pending_count`, `total_pending`, and
  `total_collected` as a legacy alias of `total_received`). `total_contributions == total_received + total_pending`.
- **Public types**: `PublicEvent`, `PublicParticipant {name, payment_status}`, `PublicEventDetail`.

All money is integer Rupiah.

## Environment and running

See [README.md](../README.md) for setup. Key facts:

- Node.js >= 22.22 (declared in `package.json` `engines`).
- API base URL comes from `VITE_API_BASE_URL` (must include the API prefix, e.g. `.../api/v1`). `.env` is git-ignored;
  `.env.example` is the template.
- The backend must allow the frontend origin and accept `Authorization: Bearer <token>`. Login, refresh and logout
  send credentials for the HttpOnly refresh cookie; ordinary API requests omit cookies. See [AUTHENTICATION.md](AUTHENTICATION.md).

## Status and known gaps

- Implemented: all pages above, both event payment modes, with loading, empty, error and validation states, and automated tests (`npm test`).
- **Not verified against a running backend.** Tests use mocked `fetch`.
- API requests use the same-origin `/api/v1` path. Vite proxies it locally; on Vercel, `vercel.json` routes it to
  `api/proxy.ts`, which uses the server-only `BACKEND_API_URL` environment variable.
- **Backend contract gaps worked around in the UI** (see [API_CONVENTIONS.md](API_CONVENTIONS.md#contract-gaps-and-workarounds)):
  no dashboard aggregate endpoint, no per-event totals in the event list, no event text search.
- Old Indonesian URLs (`/masuk`, `/acara`, `/teman`, `/publik`) no longer exist; links shared with the old
  `/publik/acara/:id` format will land on the 404 page.

## Document map

- [BUSINESS_RULES.md](BUSINESS_RULES.md): the rules the UI must respect.
- [ARCHITECTURE.md](ARCHITECTURE.md): structure, routing, auth, data flow, UI building blocks.
- [API_CONVENTIONS.md](API_CONVENTIONS.md): endpoints, types, errors, how to add an API call.
- [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md): workflow, style, testing, definition of done.
