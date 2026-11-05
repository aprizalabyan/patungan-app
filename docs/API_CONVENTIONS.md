# API conventions

How the frontend talks to the backend. Everything here is derived from this repository (`src/services/*`,
`src/types/api.ts`, tests, README). The backend's own source and OpenAPI document are **not** available to this
repository's tooling; if you need to confirm a shape, check the running backend's interactive API docs or ask the
backend owner, and then update `src/types/api.ts` and this file. **Do not guess endpoints or fields.**

## Base URL and transport

- Base URL: `API_BASE_URL` in `src/services/config.ts` = `VITE_API_BASE_URL` (trimmed, trailing slashes removed). It
  must include the API prefix (e.g. `https://host/api/v1`).
- If the variable is unset, the code falls back to `<window.location.protocol>//<window.location.hostname>:8001/api/v1`.
  README and `.env.example` still document `http://localhost:8000/api/v1`; this mismatch is a known issue. Always set
  `VITE_API_BASE_URL` explicitly. `VITE_*` values are inlined at build time; never put secrets in them.
- JSON in and out. Requests send `Accept: application/json`, and `Content-Type: application/json` when there is a body.
- Normal API requests use `credentials: 'omit'` and `Authorization: Bearer <memory access token>`. Login, refresh and
  logout use `credentials: 'include'` for the backend-managed HttpOnly refresh cookie. Cross-origin cookie requests
  require credentialed CORS. See [AUTHENTICATION.md](AUTHENTICATION.md).
- `204` responses and empty bodies resolve to `undefined`.

## The single entry point: `apiRequest`

`src/services/apiClient.ts`:

```ts
apiRequest<T>(path, { method?, body?, query?, auth?, signal? }): Promise<T>
```

- `method`: `GET` (default) | `POST` | `PATCH` | `DELETE`.
- `query`: `undefined`, `null` and `''` values are dropped.
- `auth` (default `true`): attach the in-memory Bearer token. Pass `false` for login, refresh, logout and `/public/*`.
- Failures: network error → `NetworkError`; non-2xx → `ApiError`; aborted → the original `AbortError` is re-thrown.
- 401 on an authenticated request → one refresh attempt, then one retry; login, refresh, logout and public paths are excluded. See [AUTHENTICATION.md](AUTHENTICATION.md).

Never call `fetch` anywhere else. UI code uses hooks in `src/features/*`, which call the per-resource service objects.

## Endpoint catalogue

Paths are relative to the base URL. "Auth" = needs Bearer token. Service functions are in `src/services/`.

### Authentication (`authService`)

| Method & path | Auth | Service | Request → Response |
|---|---|---|---|
| `POST /auth/login` | no | `login` | `LoginRequest {email, password}` → `TokenResponse {access_token, token_type, expires_in}`; credentials included; sets refresh cookie |
| `POST /auth/refresh` | no | `refresh` | no body → assumed `TokenResponse`; credentials included; rotates refresh cookie |
| `POST /auth/logout` | no | `logout` | no body → success/204; credentials included; revokes current refresh session |
| `GET /auth/me` | yes | `me` | → `User {id, name, email, created_at}` |

### Friends (`friendsService`)

| Method & path | Service | Request → Response |
|---|---|---|
| `GET /friends` | `list` | query `FriendListParams {page?, page_size?, search?}` → `Page<Friend>` |
| `POST /friends` | `create` | `FriendCreate` → `Friend` |
| `GET /friends/{friend_id}` | `get` | → `Friend` |
| `PATCH /friends/{friend_id}` | `update` | `FriendUpdate` → `Friend` |
| `DELETE /friends/{friend_id}` | `remove` | → 204 |

### Events and contributions (`eventsService`, `contributionsService`), all authenticated

| Method & path | Service | Request → Response |
|---|---|---|
| `GET /events` | `eventsService.list` | query `EventListParams {page?, page_size?, status?}` → `Page<Event>` |
| `POST /events` | `create` | `EventCreate` → `Event` |
| `GET /events/{event_id}` | `get` | → `Event` |
| `PATCH /events/{event_id}` | `update` | `EventUpdate` → `Event` |
| `DELETE /events/{event_id}` | `remove` | → 204 |
| `GET /events/{event_id}/summary` | `summary` | → `EventSummary` |
| `GET /events/{event_id}/contributions` | `contributionsService.list` | query `ContributionListParams {page?, page_size?, payment_status?}` → `Page<Contribution>` |
| `POST /events/{event_id}/contributions` | `create` | `ContributionCreate {friend_id, amount, notes?}` → `Contribution` |
| `PATCH /contributions/{contribution_id}` | `update` | `ContributionUpdate` → `Contribution` |
| `DELETE /contributions/{contribution_id}` | `remove` | → 204 |

### Public (`publicService`), no auth, read-only

| Method & path | Service | Request → Response |
|---|---|---|
| `GET /public/events` | `listEvents` | query `PublicEventListParams {page?, page_size?, status?}` → `Page<PublicEvent>` |
| `GET /public/events/{event_id}` | `getEvent` | → `PublicEventDetail` (event + `participants: {name, payment_status}[]`) |
| `GET /public/events/{event_id}/summary` | `getSummary` | → `EventSummary` |

## Types

All API types are in **`src/types/api.ts`**. Conventions:

- IDs are `string` (`UUID` alias); dates are `ISODate` (`YYYY-MM-DD`); timestamps are `ISODateTime` strings.
- Field names are `snake_case` exactly as on the wire; do not rename or camel-case them.
- Nullable fields are typed `T | null`. In request types, optional fields use `?`.
- PATCH semantics (from type comments): fields may be omitted to leave them unchanged. `name` (friend), `title`,
  `status`, `is_public` (event), and `amount`, `payment_status` (contribution) must not be sent as `null`. Nullable
  fields (`description`, `event_date`, `target_amount`, `nickname`, `phone`, `notes`) are cleared by sending `null`.
- Pagination: `Page<T> = {items, total, page, page_size}`; `page` is 1-based. `MAX_PAGE_SIZE = 100` and
  `DEFAULT_PAGE_SIZE = 20` live in `src/services/constants.ts`. Page sizes used: events 10, friends 20, public events 10,
  friend picker 20, "fetch all" loops 100.
- `EventSummary.progress_percent` is `number | null` and may exceed 100.
- Public participants expose only `name` and `payment_status`.

When you change or add a type, keep the doc comment that explains non-obvious semantics.

## Errors

Error responses are expected in the envelope `{ "error": { "code": string, "message": string, "details": unknown } }`
(`ApiErrorBody`). `apiRequest` turns them into:

```ts
class ApiError extends Error { status: number; code: string; details: unknown }
```

If a non-2xx response has no envelope, an `ApiError` with `code: 'http_error'` is created client-side.
`NetworkError` means no response was received.

Helpers in `src/services/errors.ts`:

- `getErrorMessage(error, fallback?)` → Indonesian, user-facing message. Maps known codes and handles `NetworkError`
  and 5xx. **Never show `error.message` from the server directly**; it is not localized.
- `getFieldErrors(error)` → `{field: message}` for `validation_error` (422) responses whose `details` is
  `{field, message}[]`. The field key is the last segment of a dotted location. The message shown is a generic
  "Nilai tidak valid."
- `isNotFound(error)` → true for HTTP 404.

Error codes the frontend knows about:

| Code | Typical status | UI message / behaviour |
|---|---|---|
| `invalid_credentials` | 401 | "Email atau kata sandi salah." (login only, does not log out) |
| `not_authenticated` | 401 | Session expired → clear session, redirect to login |
| `not_found` | 404 | "Data tidak ditemukan atau sudah dihapus." / dedicated not-found states |
| `duplicate_contribution` | 409 | "Teman ini sudah terdaftar di acara ini." |
| `friend_in_use` | 409 | Friend has history; cannot delete. `details.contributions?: number` is used in the dialog message |
| `validation_error` | 422 | Generic message plus per-field errors |

To support a new code, add it to `MESSAGES_BY_CODE` in `errors.ts` and cover it with a test.

## Adding or changing an API call

1. Confirm the contract (running backend docs or the backend owner). Do not infer it from UI needs.
2. Add or update types in `src/types/api.ts`.
3. Add a function to the matching `src/services/*Service.ts` that calls `apiRequest` (set `auth: false` only for
   public/login endpoints).
4. Add a query key in `src/services/queryKeys.ts` if it is a read.
5. Add a hook in the owning `src/features/*/use*.ts`. For mutations, define exactly which queries to invalidate
   (update the matrix in [ARCHITECTURE.md](ARCHITECTURE.md#invalidation-matrix)).
6. Handle loading, empty, error and validation states in the UI; map new error codes in `errors.ts`.
7. Add tests using `mockApi`, including a failure case. Document the endpoint in this file.

## Contract gaps and workarounds

The frontend works around these backend limitations as implemented; prefer fixing the backend contract over adding
more client workarounds.

| Need | What the API offers | Frontend behaviour |
|---|---|---|
| Dashboard totals | No aggregate endpoint | Loads all events (all pages) and each event's `/summary`, sums them only when all have loaded. Recommended: a dashboard summary endpoint. |
| Participants and collected amount in the event list | `Event` has neither | One `/events/{id}/summary` request per visible row (≤ 10). Recommended: embed summary fields in list items. |
| Event text search | `GET /events` accepts `status` only | Title search filters the current page only, and the UI says so. Recommended: a `search` parameter. |
| Paid/pending filter on participants | Endpoint accepts `payment_status` | The UI loads all participants and filters in the browser; counts and totals still come from the summary. |
| Cookie-based refresh session | Not documented in the prior backend-derived contract | Implemented per requested contract; refresh/logout and credentialed CORS must be confirmed with backend owner (see [AUTHENTICATION.md](AUTHENTICATION.md)) |

## Not known from the frontend

Do not assume any of the following; they are not visible here: database schema or engine details, token signing
algorithm, token lifetime (the frontend only uses `expires_in` from the login response), rate limiting, how the
backend orders list results, or any endpoint not listed above.
