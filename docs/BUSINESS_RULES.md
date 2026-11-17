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
- `total_received` (legacy alias `total_collected`) is the sum of the bills of **paid** contributions; `total_pending`
  is the sum of the bills of pending ones, and `total_contributions` is both together. The management UI shows
  `total_received` / `total_pending`; the public page only has the legacy names (see `EventSummary` in `src/types/api.ts`).
- There is **no client-side arithmetic on money at all**: a payment always equals the bill, so there is no remaining or
  overpaid amount to compute, and none is shown.
- The dashboard has no backend aggregate endpoint, so it adds up per-event backend summaries
  (`DashboardPage`). It shows figures only after **every** summary has loaded, never from a partial set. Behaviour as
  implemented:
  - "Acara aktif" = number of events with status `active`.
  - "Peserta (acara aktif)" = sum of `total_participants` over **active** events only.
  - "Total terkumpul" (`total_received`) and "Total belum masuk" (`total_pending`) = sums over **all** events.

## 3. Friends

- Friends are **master records** reused across events; they do not need accounts.
- Fields: `name` (required), `nickname` (optional), `phone` (optional, visible to the treasurer only).
- Deleting a friend is allowed only when the backend permits it. If the friend has contribution history the backend
  refuses with error code `friend_in_use` (HTTP 409, `details.contributions` may hold a count). The UI shows a
  friendly explanation in the confirmation dialog (`FriendsPage.deleteErrorMessage`) and keeps the friend.
- Renaming a friend refreshes cached contributions, because they embed the friend's name and nickname.

## 3a. Events

- Fields: `title` (required), `description`, `event_date`, `target_amount` (all optional), `status`
  (`active` | `completed`, default `active`), `is_public` (default `true`), and `payment_mode`
  (`track_status` by default or `paid_only`). The backend permits changing the mode only before the first
  contribution; the detail form disables the choice once contribution data is loaded and the API remains authoritative.
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
- In `track_status`, new contributions default to pending. The create request omits payment fields and the UI states
  the initial status is "belum bayar".
- In `paid_only`, the add form collects an active event account, a WIB payment time, and optional payment notes in the
  same create request. The backend creates the contribution as paid atomically; the UI does not open a second payment
  dialog. Only backend response status and payment metadata are displayed.
- **Status is `pending` or `paid` and is owned by the backend.** There is no partial status, instalment or overpayment.
  The UI never sends `payment_status` (a different value is `422 payment_status_not_editable`) and never computes it.
  `paid_at` is set by the backend; the UI shows it only when the row is `paid` and `paid_at` is non-null.
- Editing sends **only the changed fields**. A paid `paid_only` contribution may have its amount changed after explicit
  confirmation or its destination account changed; the backend preserves `paid`, `paid_at`, amount (for an account-only
  change), and payment history. A replacement account must be active, available to the event, and owned by the treasurer.
  The edit form sends only changed `amount`, `payment_account_id`, and/or `notes`; it never rewrites payment date/history.
  For a paid `track_status` contribution, the amount remains locked (`409 paid_contribution_amount_locked`) until its payment is
  cancelled. Pending contributions in `track_status` remain editable as before.
- Removing a contribution requires confirmation; the friend master record is kept. A paid contribution, or one whose
  payment was ever cancelled, cannot be removed (`409 contribution_has_payments`); the dialog explains it. Deleting an
  **event** also deletes its contributions and payments and says so.
- Notes are visible to the treasurer only.

## 4a. Payment accounts and payments

- **Accounts** are global to the treasurer (`/payment-accounts`): `type` (`bank` | `e_wallet` | `cash`), free-text
  `provider_name` (never an enum; the form only suggests providers already in use), owner name, number (always a
  string, leading zeros kept) and optional label. **Cash** ("Tunai") has no provider field and no number in the form:
  only the holder ("Nama pemegang kas") is required, and the request carries neither provider nor number (backend fixes
  the provider to `Cash`; `account_number` is `null`). Switching an account from cash to bank/e-wallet requires provider
  and number again. Each type has its own badge colour (bank blue, e-wallet green, cash amber); cash shows "Dipegang oleh
  {holder}" instead of a number everywhere (list, event accounts, paid details). They can be edited and (de)activated, never deleted. Deactivating asks
  for confirmation; it only blocks **new** payments, history is untouched.
- **Event accounts**: the event page lists the accounts offered for the event and lets the treasurer replace the set
  (`PUT`). Only active accounts can be selected; inactive ones are shown disabled and the payload is filtered to active
  ids (the dialog warns that inactive linked accounts are released). Releasing an account never deletes payments. The
  API only lists *available* links, so a released account with history is visible through payment snapshots and the
  summary breakdown rather than the event account list.
- **One payment per contribution.** The payment amount is always the contribution's bill: the app never asks for or
  sends an amount (the record body is `{payment_account_id, paid_at?, notes?}`); the form shows the bill read-only.
  A pending contribution can be recorded once, to an active account currently offered by the event, with a time (WIB
  input, sent as `+07:00`) and optional notes. Afterwards the contribution is `paid` and the record action is gone;
  a second payment cannot be created (`409 contribution_already_paid` refetches the row if another session was first).
- **The paid contribution shows the account snapshot** copied when it was paid, never the current master record, so
  renaming, deactivating or releasing the account later changes nothing. Legacy paid data without an account
  (`payment_account: null`) shows "Rekening tidak tercatat"; it is not an error. The summary breakdown instead uses the
  account's **current** identity plus a "Rekening tidak tercatat" row for `unassigned_total`.
- **Cancel** (the only way to undo a payment): confirmation dialog with an optional reason. The contribution returns to
  `pending` and its payment info disappears; rows and summary are refreshed. Cancelling works even if the account has
  since been deactivated. The backend keeps the cancelled payment as history; the app has no UI for it. There is no
  edit of a recorded payment (cancel and record again) and no hard delete anywhere.
- These cancel rules apply to `track_status`. For `paid_only`, cancellation is rejected by the backend and the UI
  hides payment and delete actions. Amount corrections use the confirmed edit flow above, which preserves the recorded
  payment details. Event deletion remains available with explicit confirmation and cascades all contribution history.

### Event payment modes

- `track_status` preserves the pending-then-record flow and its paid/pending status filter, cancel confirmation, and
  full backend summary (billed, received, pending, counts, and account receipts).
- `paid_only` records only already-paid participants. The form requires an active account currently available to the
  event, sends `paid_at` as a timezone-aware WIB timestamp, and optionally sends `payment_notes`. Its summary shows
  backend participant count, received amount, progress when supplied, and account receipts without pending figures.

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
| Account provider / owner / number / label | required (label optional), ≤ 100 / 150 / 100 / 100 chars | `PaymentAccountFormDialog` |
| Payment account | required (active, available for the event) | `ContributionPaymentDialog` |
| Payment amount | none: always the bill, read-only | `ContributionPaymentDialog` |
| Payment time | required valid `datetime-local`, interpreted as WIB | `wibInputToIso` |
| Payment notes | optional, ≤ 2000 chars | `ContributionPaymentDialog` |
| Cancel reason | optional, ≤ 2000 chars | `ContributionPaymentDialog` |
| Friend (add participant) | one must be selected | `AddContributionDialog` |

Optional text fields: blank input becomes `null` (`emptyToNull`) so the value is cleared rather than stored as an
empty string. PATCH bodies may omit fields; per the type comments, `name`/`title`/`status`/`is_public`/`amount`/
`payment_status` must not be sent as `null`; the app does not send `payment_status` at all. Paid contribution `amount`
is sent only for `paid_only` after confirmation; `track_status` paid amounts remain locked.

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
target, received, progress, still owed, paid/pending counts) plus the participant list grouped into paid and
pending. Pending entries include the person's amount; paid entries show only the name. The public link is appended only for
public events. The list is only listed, never summed.

## 9. Session

- Access tokens exist only in JavaScript memory. Refresh tokens are managed by the backend in an HttpOnly cookie; the
  frontend never reads or persists them.
- Startup refreshes the cookie session before protected pages render. Authenticated 401 responses cause one refresh
  and one retry; failed refresh clears state and returns the user to `/login`.
- After login the user returns to the page they originally requested, but only if it is an in-app path
  (open-redirect protection in `LoginPage.safeRedirect`).
- A failed login (401 on `/auth/login`) shows an error and is **not** treated as an expired session. Login/refresh/logout
  use credentials for the HttpOnly cookie; public requests do not.
- Logout clears local state even if the backend request fails. Auth event names synchronize tabs without sharing tokens.
- See [AUTHENTICATION.md](AUTHENTICATION.md) for cookie, CSRF, rotation, and browser fallback requirements.
