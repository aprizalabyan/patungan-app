# Business rules

Rules the frontend implements or must respect. Each rule notes where it lives so you can verify it. Where a rule is
enforced by the backend, the frontend's job is to present it correctly, never to replace it. Backend behaviour is
described only as far as the frontend code, types and tests reveal it.

## 1. Access

- Only the treasurer performs management operations. Management routes sit behind `ProtectedRoute`
  (`src/features/auth/ProtectedRoute.tsx`), which is a UX guard only; the backend authorizes every call.
- There is no sign-up, password reset or friend login.
- Friends only ever use the public pages.

## 2. Money

- Amounts are **integer Rupiah**. Never use floats or decimals for money.
- **The backend is authoritative** for `total_collected`, `total_pending`, `paid_count`, `pending_count`,
  `total_participants`, `progress_percent`, `payment_status` and `paid_at`. The frontend formats them and must not
  compute, adjust or persist its own balances. Do not sum `contributions[].amount` to display a total.
- `total_collected` counts **paid** contributions only; `total_pending` is the pending amount (see the comment on
  `EventSummary` in `src/types/api.ts`).
- The dashboard has no backend aggregate endpoint, so it adds up per-event backend summaries
  (`DashboardPage`). It shows figures only after **every** summary has loaded, never from a partial set. Behaviour as
  implemented:
  - "Acara aktif" = number of events with status `active`.
  - "Peserta (acara aktif)" = sum of `total_participants` over **active** events only.
  - "Total terkumpul" and "Total belum masuk" = sums over **all** events.

## 3. Friends

- Friends are **master records** reused across events; they do not need accounts.
- Fields: `name` (required), `nickname` (optional), `phone` (optional, visible to the treasurer only).
- Deleting a friend is allowed only when the backend permits it. If the friend has contribution history the backend
  refuses with error code `friend_in_use` (HTTP 409, `details.contributions` may hold a count). The UI shows a
  friendly explanation in the confirmation dialog (`FriendsPage.deleteErrorMessage`) and keeps the friend.
- Renaming a friend refreshes cached contributions, because they embed the friend's name and nickname.

## 3a. Events

- Fields: `title` (required), `description`, `event_date`, `target_amount` (all optional), `status`
  (`active` | `completed`, default `active`), `is_public` (default `true`).
- A blank target means "no target": send `null`. Progress is shown **only** when the backend returns a non-null
  `progress_percent` (the backend returns null for a missing or zero target).
- `progress_percent` is **not capped at 100**. The progress bar width is clamped to 100% for display, the label shows
  the real number, and a note appears above 100%.
- Deleting an event removes the event and, per the confirmation text shown to the user, all of its contributions.
  It always requires explicit confirmation.
- The frontend does not block contribution changes on `completed` events.

## 4. Contributions (participants)

- A friend may have **only one contribution per event**. The add dialog disables friends already listed in the event
  ("Sudah terdaftar"). That check only uses the loaded list, so the backend remains the authority: a
  `duplicate_contribution` (409) response is shown as "Teman ini sudah terdaftar di acara ini."
- **New contributions default to pending.** The create request (`ContributionCreate`) has no status field; the UI
  states the initial status is "belum bayar".
- Payment status changes only through `PATCH` with `payment_status`. `paid_at` is set/cleared by the backend; the UI
  never sends it. It displays `paid_at` only when the row is `paid` and `paid_at` is non-null.
- Reverting `paid` → `pending` asks for confirmation first, because the paid time is removed.
- Editing amount or notes sends only those fields and does not touch the status.
- Removing a contribution requires confirmation; the friend master record is kept.
- Notes are visible to the treasurer only.

## 5. Public pages and privacy

- Public pages use **only** `/public/*` endpoints (`publicService`), are called with `auth: false`, and never send the
  Bearer token. A test asserts this (`public.test.tsx`).
- They render only what the public types define: event title, description, date, status, target, participant
  **names with payment status**, and aggregate totals/progress from the public summary.
- Never show on public pages: phone numbers, nicknames, notes, per-person amounts, `paid_at`, creator, or any
  management action. If the API does not return a field, do not add it to the UI.
- A private event (`is_public = false`) or unknown id comes back as 404. The page shows "Acara tidak tersedia" and
  does not reveal whether the event exists.
- The share link and WhatsApp link are offered only for public events. The event form's visibility checkbox warns that
  anyone with the link can see participant names and payment status.
- Public pages are read-only and say so ("Hanya baca").

## 6. Validation (client-side mirror)

The frontend validates before sending to give fast feedback. **The backend is authoritative**; always handle a
`validation_error` (422) response too.

| Field | Rule | Where |
|---|---|---|
| Login email | required, basic email format | `LoginPage`, `utils/validation.ts` |
| Login password | required | `LoginPage` |
| Event title | required, ≤ 200 chars | `EventFormDialog` |
| Event description | ≤ 5000 chars | `EventFormDialog` |
| Event date | `YYYY-MM-DD` or empty | `EventFormDialog` |
| Target amount | optional integer, ≤ 1,000,000,000,000 | `EventFormDialog`, `MAX_AMOUNT` |
| Friend name | required, ≤ 120 chars | `FriendFormDialog` |
| Friend nickname | optional, ≤ 60 chars | `FriendFormDialog` |
| Friend phone | optional, 3–30 chars, digits/space/`-`/`()` with optional leading `+` | `isValidPhone` |
| Contribution amount | required integer, > 0, ≤ 1,000,000,000,000 | `validateAmount` |
| Contribution notes | optional, ≤ 500 chars | add/edit contribution dialogs |
| Friend (add participant) | one must be selected | `AddContributionDialog` |

Optional text fields: blank input becomes `null` (`emptyToNull`) so the value is cleared rather than stored as an
empty string. PATCH bodies may omit fields; per the type comments, `name`/`title`/`status`/`is_public`/`amount`/
`payment_status` must not be sent as `null`.

## 7. Formatting (Indonesian locale)

Implemented in `src/utils/format.ts`; always use these helpers.

| Kind | Rule | Example |
|---|---|---|
| Currency | `formatRupiah`, no space after `Rp`, dot thousands | `Rp200.000` |
| Date | `formatDate`, long month, parsed as a calendar date (no timezone shift); empty → `-` | `12 Desember 2026` |
| Date-time | `formatDateTime`, shown in WIB (Asia/Jakarta) with `WIB` suffix; empty → `-` | `12 Des 2026, 14.30 WIB` |
| Amount input | thousands separators while typing; parsed back to an integer by `parseRupiahInput` | `200.000` → `200000` |

Labels for statuses are in `src/utils/labels.ts`. Don't hard-code them in components.

## 8. WhatsApp summary

`buildWhatsAppSummary` (`src/utils/whatsapp.ts`) builds the copied text from the backend **summary** (title, date,
target, collected, progress, pending, participant counts) plus the participant list grouped into paid and pending.
Pending entries include the person's amount; paid entries show only the name. The public link is appended only for
public events. The list is only listed, never summed.

## 9. Session

- A 401 on an authenticated request clears the session and cached data and returns the user to `/login`.
- After login the user returns to the page they originally requested, but only if it is an in-app path
  (open-redirect protection in `LoginPage.safeRedirect`).
- A failed login (401 on `/auth/login`) shows an error and is **not** treated as an expired session.
- The password is never stored; the token is stored in `sessionStorage` only. See [ARCHITECTURE.md](ARCHITECTURE.md#authentication).
