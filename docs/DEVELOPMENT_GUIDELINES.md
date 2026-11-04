# Development guidelines

## Setup and commands

```bash
npm install
cp .env.example .env     # then set VITE_API_BASE_URL explicitly (see API_CONVENTIONS.md: default-port mismatch)
npm run dev              # http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, one run |
| `npm run test:watch` | Vitest, watch mode |
| `npm run build` | Type-check then production build to `dist/` |
| `npm run preview` | Serve the production build |

`.env` is git-ignored; never commit it or put secrets in `VITE_*` variables. `dist/` is build output.
There is no linter or formatter configured; match the surrounding code (2-space indent, single quotes, no semicolons,
trailing commas in multi-line literals). `src/services/config.ts` is the one file that currently deviates (double
quotes, semicolon); follow the majority style in new code.

The shell on Windows may be PowerShell or Git Bash; npm scripts work in both.

## Workflow

1. Read [AGENTS.md](../AGENTS.md) and the docs relevant to the task.
2. Inspect existing code for a similar feature and follow its pattern. Reuse before you create.
3. Make the smallest change that solves the problem. Do not refactor unrelated code or replace working dependencies.
4. Add or update tests for the behaviour you changed.
5. Run `npm run typecheck`, `npm test`, `npm run build`. Report the real results, including failures you did not fix.
6. Update `docs/` (and the Known issues list in `AGENTS.md`) if you changed anything they describe.

## TypeScript

- `strict` is on; unused locals/parameters are errors. Fix, don't suppress.
- No `any`. If unavoidable, add a comment explaining why. Prefer `unknown` plus narrowing (see `errors.ts`).
- Use `import type { … }` for type-only imports (`verbatimModuleSyntax`).
- Use the `@/` alias for cross-folder imports; relative imports only within a folder.
- API shapes live in `src/types/api.ts`. Do not redefine them inline. Keep wire `snake_case` names.
- Prefer small, explicit prop interfaces over inference for exported components.
- Do not cast server data to a type without a validating reason; existing code trusts the typed service layer.

## Naming and file layout

- Components and pages: `PascalCase.tsx`, one main component per file, named export (`export function X`).
- Hooks: `useThing`; query/mutation hooks for a domain live together (`useEvents.ts`, `useFriends.ts`).
- Services: `thingService.ts` exporting an object of async functions; no React.
- Utilities: `camelCase.ts` with pure functions. Put formatting in `utils/format.ts`, labels in `utils/labels.ts`.
- Tests: `name.test.ts(x)` next to the code (feature tests are `features/<area>/<area>.test.tsx`).
- Route components live in `src/pages/`; feature-specific pieces (dialogs, tables, panels) live in `src/features/<area>/`;
  domain-agnostic pieces in `src/components/ui/`.

## Language and copy

- **User-facing text: Indonesian.** Buttons, labels, errors, toasts, empty states, dialogs, `aria-label`s, page
  titles. Use the glossary in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md#glossary-ui-term--meaning) for consistent terms
  (`Lunas`, `Belum bayar`, `Peserta`, `Acara`, `Teman`).
- **Everything else: English**: identifiers, comments, route paths, query keys, test names, docs.
- Money: always `formatRupiah`. Dates: `formatDate` / `formatDateTime`. Never hand-format.
- Tone: short, polite, direct. Say what happened and what to do next. Confirmation dialogs name the item affected and
  the consequence.

## UI and accessibility checklist

- Use `src/components/ui/*`. Match the visual language (neutral stone, green accent, red destructive).
- Mobile-first and responsive. Check tables reflow via `DataTable`; no horizontal page scroll at phone width.
- Every form control has a visible label and an error slot; errors are announced via `role="alert"` where appropriate.
- Interactive elements are real `button`/`a` elements, keyboard operable with visible focus.
- Row actions that repeat (one per person) carry an `aria-label` including the person's name.
- Destructive actions use `ConfirmDialog`; irreversible ones say so. Disable controls and show a spinner while submitting.
- Each data view handles loading, error (with retry), empty and not-found states.
- Do not use `dangerouslySetInnerHTML` or render unescaped server HTML.

## Data and state rules

- Server data: TanStack Query via feature hooks, with keys from `queryKeys.ts`. No `useEffect` + `fetch`.
- After a mutation, invalidate everything derived from the changed data (see the matrix in
  [ARCHITECTURE.md](ARCHITECTURE.md#invalidation-matrix)). Summaries and participant lists must stay consistent.
- Never compute or store authoritative financial values in the client ([BUSINESS_RULES.md](BUSINESS_RULES.md)).
- Shareable list state (page, filter, search) goes in the URL; transient UI state stays local.
- Auth state comes from `useAuth()`; never read `sessionStorage` directly outside `services/session.ts`.

## Testing

- Framework: Vitest + Testing Library + `@testing-library/user-event`, jsdom. No backend or network needed.
- Mock the API with `mockApi({'METHOD /path': reply})`; render with `renderApp(route, {loggedIn: true})`.
  Use `apiError(status, code, message, details)` for failures and the fixture factories for data.
- Test user-visible behaviour: roles, labels and text, not implementation details. Prefer
  `findBy*`/`waitFor` over timeouts.
- For each feature cover the happy path plus at least one of: loading, empty, validation, API error.
- For mutations assert both the request (`calls`) and the resulting UI, and, when relevant, that dependent queries were
  refetched (e.g. participants and summary after a payment change).
- Public-page tests must keep asserting that only `/public/*` is called and no `Authorization` header is sent.
- A test should fail for the right reason. Don't weaken or delete a failing test to make the suite pass; fix the
  cause or raise it.

Current status: 7 test files, 50 tests; 49 pass. The failing one is the URL-building test in
`src/services/apiClient.test.ts` (expects port 8000, the code default is port 8001). See Known issues in
[AGENTS.md](../AGENTS.md).

## Security

- Never log, persist or embed passwords or tokens. The token lives only in `sessionStorage` through `session.ts`.
- Send the token only to management endpoints (`auth: true`); public calls pass `auth: false`.
- Only same-app paths are accepted as post-login redirect targets.
- Client route guards are UX; assume the backend rejects unauthorized calls, and handle 401/403/404 gracefully.
- Don't expose phone numbers, notes or per-person amounts outside treasurer-only screens.

## Definition of done

- [ ] Behaviour matches [BUSINESS_RULES.md](BUSINESS_RULES.md); any new rule is documented there.
- [ ] No raw `fetch`, no `any`, no new unexplained dependency, no backend/database code.
- [ ] Indonesian copy for users; English code/identifiers/routes.
- [ ] Loading, empty, error and validation states handled; destructive actions confirmed.
- [ ] Cache invalidation correct; totals come from the backend.
- [ ] Tests added/updated and passing; `npm run typecheck` and `npm run build` succeed.
- [ ] Docs and Known issues updated if affected.
- [ ] Final report states what changed, what was run, the actual results, and anything unverified (for example, no
      end-to-end run against a live backend).

## Git

- Do not commit or open pull requests unless asked. Keep commits focused; don't commit `.env`, `node_modules/` or `dist/`.
