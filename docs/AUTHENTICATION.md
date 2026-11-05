# Authentication

This frontend implements the requested rotating refresh-cookie contract. The backend is maintained separately and
has not been verified live. The repository's previous API documentation described only `POST /auth/login` returning
a Bearer token and `GET /auth/me`; `/auth/refresh`, `/auth/logout`, HttpOnly cookies, and credentialed CORS were not
documented. This implementation therefore assumes those endpoints are now supported.

## Lifecycle

- Login posts email and password to `/auth/login` with `credentials: 'include'`. The response's `access_token` is
  stored only in the current tab's JavaScript memory. The refresh cookie is never read by JavaScript.
- On app startup, the provider calls `POST /auth/refresh` with credentials, then calls `GET /auth/me`. Protected
  routes show a loading state until that initialization completes. Initialization is single-flight within a provider,
  including React Strict Mode effect replay.
- Authenticated API calls attach `Authorization: Bearer <access_token>` and use `credentials: 'omit'`. Public calls
  remain unauthenticated and never trigger refresh.
- A 401 from a protected API call starts a single-flight refresh. The original request is retried once with the new
  token. Login, refresh and logout are excluded, preventing refresh loops. A failed refresh clears memory and query
  cache, notifies other tabs, and the route guard sends the user to login.
- Logout posts to `/auth/logout` with credentials. Whether it succeeds or fails, local auth and query state are
  cleared and other tabs are notified.

## Multiple tabs

`BroadcastChannel('patungan-auth')` broadcasts only event names (`AUTH_LOGIN`, `AUTH_LOGOUT`,
`AUTH_SESSION_EXPIRED`, `AUTH_TOKEN_REFRESHED`); it never carries tokens or user data. A tab receiving login or token
refresh obtains its own access token by refreshing the shared HttpOnly cookie. Logout and expiry clear each tab.

Refresh calls use the `patungan-auth-refresh` Web Lock where available. A waiting tab enters the lock after the
previous request has completed, at which point the browser has processed its `Set-Cookie`; it refreshes using the
current cookie, never a token copied from another tab. When Web Locks are unavailable, the client uses a short-lived
`localStorage` lease containing only an expiry and random owner identifier. This fallback is best-effort: browser
crashes, storage denial, or lease races can allow concurrent refresh in older browsers. The backend should tolerate
brief overlap or provide a server-side refresh grace period if those browsers must be supported reliably.

## Browser and deployment requirements

Web Locks are preferred in current Chromium, Firefox and Safari. BroadcastChannel is used when available; without it,
cross-tab logout/login notification is unavailable. The legacy lock fallback needs same-origin localStorage. No auth
token is stored in either browser storage API.

The backend must set the refresh cookie as `HttpOnly`, `Secure` in production, and an appropriate `SameSite` value.
Cross-site frontend/backend deployments generally need `SameSite=None; Secure`, credentialed CORS for the exact
frontend origin, and `Access-Control-Allow-Credentials: true`. Cookie-authenticated state-changing requests need
backend CSRF protection (for example Origin validation and/or a CSRF token). The frontend cannot configure these
server headers or cookie attributes.

## Assumed API contract

| Method/path | Request | Assumed response |
|---|---|---|
| `POST /auth/login` | `{email, password}`, credentials included | `{access_token, token_type, expires_in}` and HttpOnly refresh cookie |
| `POST /auth/refresh` | no body, credentials included | `{access_token, token_type, expires_in}` and rotated refresh cookie |
| `GET /auth/me` | Bearer access token | `User {id, name, email, created_at}` |
| `POST /auth/logout` | no body, credentials included | success/204 and revocation of current refresh session |

The login shape and `/auth/me` are documented in this repository. Refresh and logout response semantics are assumptions
from the requested contract and need confirmation with the backend owner.
