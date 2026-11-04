# Architecture

## Stack

| Concern | Choice | Version range (package.json) |
|---|---|---|
| UI | React | ^19.3.1 |
| Build / dev server | Vite (+ `@vitejs/plugin-react`) | ^8.3.5 |
| Language | TypeScript, `strict` | ^7.0.2 |
| Routing | React Router (`react-router`) | ^8.5.1 |
| Server state | TanStack Query | ^5.105.0 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | ^4.3.3 |
| HTTP | Browser Fetch API behind `apiClient` | n/a |
| Tests | Vitest + Testing Library (jsdom) | vitest ^5.0.5 |

Node.js >= 22.22. No global state library: server data lives in TanStack Query, auth in a React context, ephemeral UI
state in component state, shareable list state in the URL.

TypeScript flags worth knowing (`tsconfig.json`): `strict`, `noUnusedLocals`, `noUnusedParameters`,
`verbatimModuleSyntax` (use `import type` for type-only imports), `isolatedModules`. Path alias `@/*` → `src/*`
(also configured in `vite.config.ts`).

## Folder structure

```
src/
  main.tsx               Entry: BrowserRouter > AppProviders > AppRoutes
  AppProviders.tsx       QueryClientProvider > ToastProvider > AuthProvider; createQueryClient defaults
  AppRoutes.tsx          Route table
  index.css              Tailwind import + base styles
  pages/                 One component per route (compose features + ui; little logic)
  components/
    ui/                  Reusable, domain-agnostic building blocks
    layout/              AppLayout (treasurer), PublicLayout, Logo
  features/
    auth/                AuthProvider, authContext/useAuth, ProtectedRoute
    events/              useEvents.ts (queries/mutations), dialogs, summary panel, contributions table
    friends/             useFriends.ts, FriendFormDialog
    public/              usePublicEvents.ts
  services/              apiClient, config, session, errors, constants, queryKeys, *Service.ts
  hooks/                 useDebouncedValue, useCopyToClipboard, usePageParam/useSearchParamState
  types/api.ts           API request/response types (single file)
  utils/                 format, labels, validation, whatsapp, publicUrl, clipboard, cn
  test/                  setup.ts, utils.tsx (mockApi, renderApp, fixtures)
```

Layering (dependencies point downward only):

```
pages  →  features (hooks + feature components)  →  services  →  apiClient  →  fetch
            ↘ components/ui, hooks, utils, types (leaf-level helpers)
```

- `pages/` never call `services/` directly except through a feature hook.
- `services/` has no React and no UI imports (except `errors.ts` message strings, which are plain data).
- `components/ui/` knows nothing about events or friends.

## Routing

`src/AppRoutes.tsx` (React Router `Routes`/`Route`):

- `/login` → `LoginPage`
- `/public` (`PublicLayout`): index → `PublicEventsPage`; `events/:eventId` → `PublicEventPage`. **Not** behind auth.
- `ProtectedRoute` > `AppLayout`: `/` → `DashboardPage`, `events`, `events/:eventId`, `friends`.
- `*` → `NotFoundPage`.

Build links with literal English paths; use `publicEventPath(id)` / `publicEventUrl(id)` from `utils/publicUrl.ts`
for public links. List state (page, filters, search, `new` flag) lives in the query string through
`usePageParam` / `useSearchParamState` so pages are linkable and survive reloads. The production host must serve
`index.html` for unknown paths (client-side routing).

## Authentication

Files: `services/session.ts`, `services/apiClient.ts`, `services/authService.ts`,
`features/auth/{AuthProvider,authContext,ProtectedRoute}.tsx`, `pages/LoginPage.tsx`.

Flow:

1. `LoginPage` validates, then `useAuth().login()` calls `POST /auth/login`. The response holds `access_token` and
   `expires_in` (seconds). `AuthProvider.login` clears the query cache, then `session.set(token, expires_in)`.
2. `session` stores `{token, expiresAt}` in **`sessionStorage`** (key `patungan.session`), expiring 30 seconds early.
   `getToken()` is side-effect free so it can be a `useSyncExternalStore` snapshot; `subscribe` notifies listeners.
   The password is never stored. `localStorage` is not used for auth.
3. `AuthProvider` exposes `status`: `loading` (token present, `/auth/me` in flight), `authenticated`,
   `unauthenticated` (no token), or `error` (token present but `/auth/me` failed for a non-401 reason; `retry()`
   available), plus `user`, `login`, `logout`.
4. `ProtectedRoute` redirects `unauthenticated` to `/login` with `state.from = path + search`, shows a spinner while
   `loading`, an error with retry on `error`, otherwise renders the outlet.
5. `apiRequest` adds `Authorization: Bearer <token>` when `auth !== false` and a token exists. On a **401 to an
   authenticated request** it clears the session and calls the registered unauthorized handler, which clears the
   query cache and shows an info toast. The guard then redirects to `/login`.
6. Logout: `session.clear()` + `queryClient.clear()` + navigate to `/login`.

Rules: public endpoints and `login` pass `auth: false`; requests use `credentials: 'omit'`; the post-login redirect
target must be an in-app path starting with a single `/`.

## Data fetching (TanStack Query)

`createQueryClient()` in `AppProviders.tsx`:

- `staleTime` 30 s; `refetchOnWindowFocus` on.
- Query retry: never for `ApiError` with status < 500; otherwise up to 2 retries. Mutations never retry.
- Public event queries additionally skip retry on 404 (`usePublicEvents.ts`).

Query keys are centralized in `services/queryKeys.ts` and are hierarchical so a prefix invalidates a subtree:

| Key | Meaning |
|---|---|
| `['auth','me']` | current user |
| `['friends', 'list', params]` | friends page |
| `['events', 'list', params]` | events page (`events.lists` = prefix) |
| `['events', 'everything']` | all events across pages (dashboard) |
| `['events', 'detail', id]` | one event |
| `['events', 'summary', id]` | backend summary for one event (shared by detail, list rows, dashboard) |
| `['events', 'contributions', id, params]` | participants of an event |
| `['public', 'events', params]`, `['public','event', id]`, `['public','summary', id]` | public data |

Hooks (all in `features/*/use*.ts`) wrap `services/*`. Components must use these hooks.

### Invalidation matrix

| Mutation | Cache effect |
|---|---|
| Create event | seed `detail`; invalidate event lists and `everything` |
| Update event | set `detail`; invalidate lists, `everything` and `summary(id)` (target drives progress) |
| Delete event | remove `detail`, `summary`, `contributions` for the id; invalidate lists and `everything` |
| Add / delete contribution | invalidate `contributions(eventId)` **and** `summary(eventId)` |
| Update contribution | write the returned row into cached contribution lists (shows `paid_at` immediately), then invalidate both as above |
| Create / delete friend | invalidate `['friends']` |
| Update friend | invalidate `['friends']` and `['events','contributions']` (embedded names) |

When you add a mutation, extend this table and make sure everything derived from the changed data is refetched from
the backend. Do not patch totals by hand.

### Multi-page loads

`useAllEvents` and `useAllContributions` walk every page at `MAX_PAGE_SIZE` (100) because the dashboard and event
detail need complete sets. `useEventSummaries` fans out one summary request per event ID and returns a Map plus
aggregate loading/error state.

## UI building blocks (`src/components/ui`)

`Button` (+ `buttonClasses` for links), `Card`/`CardHeader`/`StatCard`, `Badge` (`PaymentStatusBadge`,
`EventStatusBadge`, `VisibilityBadge`), `TextField`/`TextAreaField`/`SelectField`/`CheckboxField`, `AmountField`,
`Dialog` + `ConfirmDialog`, `Toast` (`ToastProvider`, `useToast`), `DataTable`, `Pagination`, `ProgressBar`,
`Spinner`/`LoadingState`, `EmptyState`/`ErrorState`/`InlineError`, `PageHeader`. Prefer these over ad-hoc markup;
extend them rather than duplicating.

Conventions:

- **Visual language**: neutral stone backgrounds, green accents (`green-700` primary), red for destructive, amber for
  pending. Utility classes via Tailwind; join conditional classes with `cn()`.
- **Dialogs**: `Dialog` traps focus, closes on Escape/backdrop (unless `dismissible={false}` during submit), and restores
  focus. Mark the preferred initial focus target with `data-autofocus`. Form dialogs mount their form only while open
  so state resets from fresh props.
- **Tables**: `DataTable` is one semantic table that reflows into stacked cards below `md`; each cell shows its column
  header as a label on mobile (`hideMobileLabel` for title/action cells). Do not build a second mobile layout.
- **Forms**: controlled inputs, `noValidate`, client validation first (field errors under inputs), then submit. On
  failure show field errors from `getFieldErrors` and a general message from `getErrorMessage` in `InlineError`.
  Required fields use the `required` prop for the asterisk; every input has a visible label.
- **State screens**: every data view handles loading (`LoadingState`), error (`ErrorState` with retry), empty
  (`EmptyState` with an action) and not-found states.
- **Feedback**: success and recoverable failures use toasts; failures inside a dialog stay inside the dialog.
- **Accessibility**: skip link in `AppLayout`, labelled navigation landmarks, `aria-live` toast region,
  `aria-invalid`/`aria-describedby` on fields, `role="progressbar"` with `aria-valuetext`, descriptive `aria-label`s on
  row actions that include the person's name.

## Testing architecture

- `src/test/setup.ts`: jest-dom matchers, cleanup, clears `sessionStorage` after each test.
- `src/test/utils.tsx`:
  - `mockApi(routes)` stubs `fetch` with a table keyed `"METHOD /path"` (path relative to the API base, no query).
    Function values receive the recorded call. Unmocked requests throw, failing the test. Returns `{calls, routes}`;
    mutate `routes[...]` mid-test to simulate server state changing.
  - `renderApp(route, {loggedIn})` renders the real app (providers + routes) in a `MemoryRouter`, with a
    non-retrying `QueryClient`, and a `location` probe (`data-testid="location"`).
  - `apiError`, `page`, and fixture factories (`makeEvent`, `makeSummary`, `makeFriend`, `makeContribution`, `user`).
- Tests are colocated: `features/*/*.test.tsx`, `services/apiClient.test.ts`, `utils/*.test.ts`.
