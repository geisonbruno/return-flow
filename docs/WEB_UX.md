# ReturnFlow — Web UX

This document is the Web UX checkpoint required before Phase 6 begins (`docs/IMPLEMENTATION_PLAN.md` §14). It approves the functional flow for the ADMIN web application across Phases 6, 7A, 7B, and 8, without implementing any of them. It does not track implementation status — see `PROGRESS.md` for that.

## 1. Purpose

- **Who uses it:** an authenticated `ADMIN` — warehouse staff, managers, supervisors, and owners share one role in V1 (root `CLAUDE.md` §6.2). There is no permission hierarchy between them.
- **Problem it solves:** replaces the paper return sheet's warehouse side — finding a return, reviewing it, recording the warehouse decision, closing or cancelling it, and printing a record — with one traceable digital workflow.
- **Why desktop-first:** the warehouse review workflow (multiple Yes/No decisions, an observation field, a drawn signature) is done at a desk or counter, not walking a floor with a phone. A desktop-first, reasonably responsive layout matches that reality better than a mobile-first one.
- **What this checkpoint approves:** navigation, page structure, the dashboard, the returns list, Return Details, the warehouse review flow, and the administration flows — as functional outlines, not visual designs.
- **What remains outside this checkpoint:** all implementation (Phases 6, 7A, 7B, 8, 9), visual branding, and any backend change.

## 2. MVP boundaries

**Included** (across Phases 6–9, not this checkpoint):

- ADMIN login and session restoration
- Operational dashboard
- Returns list
- Return detail
- Photo and customer-signature viewing
- Warehouse-review workflow
- User management
- Route management

**Excluded** (from all of Phases 6–9 and this checkpoint):

- Charts
- Speculative analytics
- Custom report builder
- Drag-and-drop dashboards
- Real-time WebSockets
- Notifications center
- Dark mode
- Animation work
- A full design system
- Customer portal
- Driver web portal
- Billing
- SaaS tenant self-service
- PDF implementation during this checkpoint — **PDF remains Phase 9**, mentioned only as a Return Details secondary action (§12, §13) here.

## 3. Information architecture

| Route | Purpose |
|---|---|
| `/login` | ADMIN sign-in |
| `/dashboard` | Operational summary (Phase 6) |
| `/returns` | Returns list (Phase 6) |
| `/returns/:returnId` | Return Details, including review actions once Phase 7B exists |
| `/users` | User management (Phase 8) |
| `/routes` | Route management (Phase 8) |

- **Application shell:** one authenticated shell wrapping all routes above `/login`; unauthenticated access to any protected route redirects to `/login`.
- **Primary navigation:** a persistent sidebar or top bar with four links — Dashboard, Returns, Users, Routes — no nested menus.
- **Active state:** the current route's nav item is visually distinct (not color alone — see §10).
- **Logout:** a fixed control in the shell (e.g. top-right), always reachable, never inside a nested menu.
- **Tenant identity:** the tenant name shown once in the shell header — never a tenant switcher or selector (root `CLAUDE.md` §21.1: the client never chooses a tenant).
- **Page titles:** each route sets a concise browser title ("ReturnFlow — Dashboard", "ReturnFlow — Return RF-000123").
- **Breadcrumbs:** only on Return Details ("Returns / RF-000123") — nowhere else, since no other route is nested.

## 4. Authentication and session behavior

The web client reuses the existing `/api/v1/auth/{login,refresh,logout}` and `GET /api/v1/auth/me` contract — no second authentication system.

| State | Behavior |
|---|---|
| Login form | Email + password, submit disabled while invalid/submitting |
| Loading | Submit button shows a spinner; form stays filled |
| Invalid credentials | One generic message (matches the API's deliberately non-specific failure) — never "email not found" vs "wrong password" |
| Session restoration | On load, silently attempt to restore from a stored refresh token before rendering any protected route; show a brief loading state, not a login flash |
| Expired access token | Silent refresh-and-retry, exactly once, mirroring the mobile app's pattern — invisible to the user unless the refresh itself fails |
| Refresh failure | Clear session, redirect to `/login` with a plain "Your session has expired. Please sign in again." message |
| Inactive user | Login rejected with the same generic invalid-credentials message — never reveals that the account exists but is inactive |
| Unauthorized role (e.g. a DRIVER credential) | Rejected the same way login already rejects a non-ADMIN on mobile — a plain message, no role-specific detail |
| Logout | Clears local session state and calls the logout endpoint best-effort, then redirects to `/login` |
| Redirect after login | If the ADMIN was redirected to `/login` from a protected route, return them there after successful login; otherwise land on `/dashboard` |
| Token display | Never shown anywhere in the UI, logs, or error messages |

## 5. Operational dashboard — Phase 6

Four summary cards, read-only:

| Card | Counts | Click behavior |
|---|---|---|
| Waiting Warehouse | Returns with status `AWAITING_WAREHOUSE` in this tenant | Opens `/returns` filtered to that status |
| In Review | Returns with status `IN_REVIEW` in this tenant | Opens `/returns` filtered to that status |
| Closed Today | Returns closed today (see Resolved MVP decisions below) | Opens `/returns` filtered to closed + today |
| Returns Today | Returns created today (see Resolved MVP decisions below) | Opens `/returns` filtered to created today |

Each card: a loading skeleton while the count loads, a plain `0` (not a hidden/blank card) when the count is genuinely zero, and a compact inline error with retry if the summary request fails — the rest of the dashboard still renders.

**Latest Returns** (below the cards): a compact list/table of the most recent returns tenant-wide — return number, customer, product, driver, route, reason, status, created time — each row linking to Return Details. Same loading/empty/error handling as the cards. It shows absolute timestamps (most recent first), not a "today" bucket, so the operational-day rule below only matters where it's explicitly used — the cards and date-range filters.

Phase 6 is **read-only operational visibility only** — no review action starts from the dashboard.

### Resolved MVP decisions: operational day

"Today" (Closed Today, Returns Today, and any date-range filter that uses relative days — see §6) is a **server-computed business day**, not a browser-local one:

- The initial configured business timezone is **Australia/Sydney**.
- The operational day runs from local midnight to the next local midnight in that timezone, converted to UTC for the actual database query — the browser's own timezone never determines what counts as "today."
- Daylight-saving transitions are handled correctly (a 23- or 25-hour day at the transition, not a fixed 24-hour offset).
- Every ADMIN in the initial Warehouse tenant sees identical counts regardless of where they're browsing from.
- Tenant-specific timezone configuration is deferred until multi-tenant rollout actually needs it — the exact configuration-property name is an implementation detail for Phase 6, not a UX question.

### Approved decisions: dashboard analytics

The dashboard also carries three analytics visualizations — **Returns Over Time**, **Reasons Distribution**, and **Top Routes by Returns**. Their durable, approved behavior:

- **The four summary cards stay independent of the analytics date range.** Waiting Warehouse, In Review, Closed Today, and Returns Today describe current/today operational state and are never reinterpreted through the selected range. **Recent/Latest Returns is likewise independent** and keeps its own most-recent-first query.
- **One shared date range controls all three charts.** There is a single range selector on the dashboard, not one per chart, and all three always describe the same period.
- **The analytics population is "returns created in the selected range"** — every tenant-scoped return whose creation date falls inside the selected operational calendar dates, *regardless of its current lifecycle status*. A return that is now `CLOSED`, `IN_REVIEW`, `AWAITING_WAREHOUSE`, or `CANCELLED` counts the same. This is deliberate: the charts describe return *activity created* during the period rather than mixing creation and closing dates in one picture.
- **Range dates are operational calendar dates** in the same Australia/Sydney business day defined above — both bounds inclusive, never browser-local.
- **Returns Over Time has a continuous timeline**: every calendar date in the range is present, including days with zero returns, so the chart never has to infer a gap.
- **Reasons Distribution shows only reasons that actually occurred** in the range; a reason with no returns is absent rather than a zero slice.
- **Top Routes shows the five busiest routes** by return count, and a route that has since been deactivated still appears for its historical returns.
- **Percentages, totals, labels, colors, and every other display concern belong to the frontend.** The API returns reason enum values and raw counts only; the Web already owns user-facing reason labels and can sum the counts itself for a donut total or percentage.
- Any preset such as "Last 7 days" is a **frontend default**. The backend understands explicit calendar-date boundaries only and invents no preset of its own.

## 6. Returns list — Phase 6

- **Pagination:** server-side, page-based (matches `docs/IMPLEMENTATION_PLAN.md` §15's "server-paginated returns list").
- **Sorting:** stable, newest-created-first by default; no user-configurable multi-column sort in V1.
- **Page size:** one fixed, reasonable default (e.g. 25); no user-configurable page-size control in V1.
- **Global search:** one search box covering return number, customer, product, driver, and route (root `CLAUDE.md` §17.2).
- **Filters:** status, reason, date range, driver, route — a filter panel or bar above the table. Any relative-day option (e.g. "Today") uses the same server-computed Australia/Sydney business day as the dashboard (§5).
- **Clear filters:** one explicit action resets search + all filters + pagination together.
- **URL persistence:** search/filter/page state reflected in the URL query string, so a direct link or refresh reproduces the same view.
- **States:** loading (skeleton rows), empty tenant (no returns exist yet — distinct message from "no results"), no-results (filters/search matched nothing, with a visible "Clear filters" action), API failure (inline error + retry, filters preserved), and a manual refresh action.

**Minimum table columns:** return number, created date/time, customer, product, quantity/unit, reason, driver, route, status, reviewer (when in review or closed). This matches `apps/web/CLAUDE.md`'s recommended columns exactly. Everything else (observation, reason details, photos, signature, warehouse decisions, timestamps beyond creation) belongs only in Return Details — the table stays scannable.

## 7. Return Details

Information hierarchy, top to bottom:

1. Return number + current status (prominent, always visible)
2. Customer name, product name, quantity + unit, reason (+ reason details when `OTHER`), observation
3. Driver, route (the snapshot recorded at creation — root `CLAUDE.md` §11.5)
4. Creation timestamp
5. Photos: count + gallery, loaded through the authenticated content endpoint
6. Customer signature: signer name, `signedAt`, and the rendered signature, loaded through the authenticated content endpoint
7. Current reviewer (once Phase 7A/7B exist) and review-start timestamp
8. Warehouse decision fields, observation, representative name, and signature (once available — `CLOSED` or mid-review)
9. Operational history/timeline (created → review started → closed/cancelled) — only if the backend already exposes enough data to build it cheaply; otherwise the discrete timestamps above are sufficient for V1 and a timeline is not required.

**Media loading:** photos and the customer signature are fetched via authenticated requests to their existing `.../content` endpoints (`GET /api/v1/driver/returns/{returnId}/photos/{photoId}/content`, `GET /api/v1/driver/returns/{returnId}/signature/content`) — never a public URL, never a token in a query string, never Base64 embedded in `ReturnResponse`, never an exposed storage key. This matches how those endpoints already work for the DRIVER app; the ADMIN web app needs no new media contract, only ADMIN-scoped equivalents (see §14 Future API requirements).

| State | Behavior |
|---|---|
| Loading | Skeleton for the whole page on first load |
| Missing media | "No photos yet." / "Signature pending." — the same language the mobile app already uses |
| Media fetch failure | The rest of the page still renders; the failed photo/signature shows an inline retry, not a page-level error |
| Return not found | A plain "This return could not be found." page, matching the mobile app's own wording |
| Permission error (cross-tenant) | Identical to not-found — never reveals that a return exists in another tenant |

Simply opening this page **never** starts a review (root `CLAUDE.md` §9.1, §17.3).

## 8. Warehouse review flow — Phases 7A and 7B

Documented functionally; not implemented by this checkpoint.

| Step | User sees | Action | Confirmation | After success | After conflict/stale |
|---|---|---|---|---|---|
| Start Review | "Start Review" button (only while `AWAITING_WAREHOUSE`) | Explicit click | None (single click is the commitment) | Status becomes `IN_REVIEW`; reviewer + timestamp shown; warehouse fields become editable | If another ADMIN already started it in the meantime: refetch, show current reviewer, no silent overwrite |
| Reviewing (owner) | Warehouse Yes/No fields, observation, representative name, signature pad | Fill fields, draw signature — held only as local browser state until Close (see Resolved MVP decisions below) | — | Nothing persists until Close succeeds | Navigating away or an expired session with unsaved values simply loses them — no draft was ever sent to the server |
| Reviewing (non-owner ADMIN) | Same page, read-only, "In review by {name}" banner | View only | — | — | — |
| Release Review | "Release Review" button (owner only) | Explicit click + confirm | Confirm dialog; if local fields are unsaved, the dialog states they will be discarded | Status returns to `AWAITING_WAREHOUSE`; reviewer cleared; local form state discarded | — |
| Takeover | "Take Over Review" button (non-owner ADMIN, if approved per root `CLAUDE.md` §9.2) | Explicit click + confirm, states whose review is being taken over | Yes/No confirm dialog naming the current owner | Reviewer reassigned to the new ADMIN; the new reviewer starts from a clean form — the previous reviewer's unsaved browser state was never transmitted, so there is nothing to inherit | — |
| Close | "Close Return" button (owner only, enabled once all required fields + signature are present) | Explicit click | Confirmation summarizing the decision fields | The complete warehouse decision is submitted and persisted atomically; status becomes `CLOSED`; page becomes fully read-only; PDF action appears (Phase 9) | Validation error listing missing required fields; the failed submission's values remain visible on the form for correction and retry (not cleared) |
| Cancel | "Cancel Return" button (ADMIN, from `AWAITING_WAREHOUSE` or `IN_REVIEW`) | Explicit click, requires typing/selecting a reason | Confirmation dialog, reason required before it's enabled | Status becomes `CANCELLED`; page becomes fully read-only | — |

Terminal states (`CLOSED`, `CANCELLED`) render every field read-only, with no review/edit controls at all (root `CLAUDE.md` §9.3, §9.4).

### Resolved MVP decisions: review-form persistence

The warehouse review form has **no autosave and no draft persistence**. Values stay in local browser state until Close, which submits the complete warehouse decision atomically — one request, all required fields together, terminal persistence only on success. This is intentional: the review form is small (four Yes/No fields, an observation, a representative name, a signature) and is meant to be completed in one sitting, not across interrupted sessions.

Consequences, all already reflected in the table above:

- Navigating away with unsaved values requires a confirmation prompt, since they would otherwise be silently lost.
- Releasing the review with unsaved values requires confirmation and discards those values — the backend never saw them.
- Taking over a review never inherits another reviewer's unsaved browser state, because none was ever sent.
- A failed Close keeps the form's values visible for correction and retry, rather than clearing them.

No `DRAFT` status, partial-decision persistence, `localStorage` persistence, or background sync is introduced for this. A persisted "Save Progress" capability may be worth considering later, but only if real pilot use shows reviews are commonly interrupted — not before.

## 9. Administration flows — Phase 8

**User management:**

- List users (paginated, tenant-scoped)
- Create user (name, email, role, route if DRIVER)
- Edit permitted fields (name, route)
- Activate/deactivate
- Assign one route to a DRIVER (required for an active DRIVER, forbidden for ADMIN — root `CLAUDE.md` §22.2)
- Reset password (triggers the existing temporary-password flow)
- Prevent invalid ADMIN route assignment (form-level: route field hidden/disabled for ADMIN)
- Prevent invalid active-DRIVER-without-route (form-level: route required while role=DRIVER and active=true)
- Prevent the current ADMIN from deactivating or demoting themselves (disable that specific action on their own row, with a plain explanation)

**Route management:**

- List routes
- Create route (code + name)
- Edit route
- Activate/deactivate
- Deactivating a route still assigned to an active DRIVER shows a clear validation message rather than a generic error (the backend already rejects this — root `CLAUDE.md` §17.6)
- No permanent deletion (root `CLAUDE.md` §9.5 principle applied to routes/users too — no hard delete anywhere)

Both flows are simple forms + a table, no multi-step wizards, no modal-heavy sequences beyond a single confirmation dialog for destructive-feeling actions (deactivate).

## 10. Feedback and system states

This is the single source for generic state behavior. §5–§9 and §13 only note page-specific content (what a particular empty/failure message says) — the underlying loading/failure/conflict mechanics below apply everywhere without restatement.

| Situation | Behavior |
|---|---|
| Initial page loading | Full-page skeleton |
| Inline loading | Local spinner/skeleton scoped to the loading region only |
| Full-page failure | Plain message + retry action |
| Empty state | Distinct, friendly message — never identical wording to a failure |
| No search results | "No returns match your search/filters." + Clear filters |
| Validation errors | Inline, next to the field, plain language |
| Authentication expiration | Redirect to `/login` with the exact message in §4 |
| Forbidden action | Plain "You don't have permission to do this." — never a stack trace |
| Not found | Plain "This return could not be found." (or user/route equivalent) |
| Stale data | Refetch + clear message before allowing the action again |
| Optimistic-lock conflict | Refetch authoritative state, explain a change happened elsewhere, discard the unsaved diff |
| Review-ownership conflict | Show current reviewer's name, never allow a silent overwrite |
| Successful action | A brief, dismissible confirmation (toast or inline) |
| Destructive confirmation | A modal naming exactly what will happen, requiring explicit confirmation |
| Retry | Same action, same button, always available on a failure state |

No stack trace, filesystem path, storage key, token, database detail, or internal exception name is ever shown — matching the backend's own `ProblemDetail` discipline and the mobile app's `toSafeErrorMessage` pattern.

## 11. Responsive behavior

- **Desktop** (primary target): persistent sidebar/nav, full table with every column from §6, side-by-side layout on Return Details where it helps scanning (e.g. driver info beside photos).
- **Tablet:** nav collapses to an accessible toggle if needed; table drops lower-priority columns (e.g. route, reviewer) behind a "more" affordance or row expansion; filters move into a compact panel; all review actions remain reachable.
- **Small browser viewport (phone-width browser):** table becomes a card-per-row list; every critical action (Start Review, Close, Cancel) stays reachable, just stacked vertically; this is for occasional access, not the primary warehouse workflow — root `CLAUDE.md` explicitly targets a driver mobile app for the phone form factor, not this web app.

No separate mobile web product is designed.

## 12. Phase boundaries

| Phase | Scope |
|---|---|
| **Web UX checkpoint** (this document) | Documentation and functional-flow approval only — no code |
| **Phase 6** | Web authentication, operational summary, Latest Returns, paginated/searchable/filterable return list, read-only Return Details, authenticated photo and customer-signature display |
| **Phase 7A** | Warehouse-review backend lifecycle and authorization |
| **Phase 7B** | Warehouse-review web actions and states |
| **Phase 8** | Web user and route administration |
| **Phase 9** | PDF generation and access |

This checkpoint implements none of the above.

## 13. Low-fidelity page outlines

### Login

- **Header:** ReturnFlow wordmark, no nav
- **Primary content:** email + password form, centered
- **Primary action:** Sign in
- **Secondary actions:** none (no self-service password reset in V1 web UI — matches root `CLAUDE.md` §24's admin-triggered reset model)
- **Loading:** button spinner, form disabled
- **Empty:** n/a
- **Failure:** one generic invalid-credentials message above the form

### Dashboard

- **Header:** shell nav (Dashboard active), tenant name, logout
- **Primary content:** four summary cards, then Latest Returns list
- **Primary action:** click a card → filtered Returns list
- **Secondary actions:** click a Latest Returns row → Return Details
- **Loading:** skeleton cards + skeleton list
- **Empty:** cards show `0`; Latest Returns shows "No returns yet."
- **Failure:** inline error + retry per section, independent of each other

### Returns

- **Header:** shell nav (Returns active), search box, filter bar
- **Primary content:** paginated table
- **Primary action:** click a row → Return Details
- **Secondary actions:** Clear filters, page navigation, manual refresh
- **Loading:** skeleton rows
- **Empty:** distinct "no returns in this tenant yet" vs. "no results for these filters" (§6)
- **Failure:** inline error + retry, filters preserved

### Return Details

- **Header:** breadcrumb (Returns / RF-000123), status badge
- **Primary content:** the information hierarchy from §7
- **Primary action:** Start Review (while waiting) or the active review's Close/Cancel (while in review, owner only)
- **Secondary actions:** Release Review, Take Over Review, Download PDF (closed only, Phase 9)
- **Loading:** full-page skeleton
- **Empty:** "No photos yet." / "Signature pending." per §7
- **Failure:** "This return could not be found." for 404-equivalent; inline retry for a media-fetch failure only

### Users

- **Header:** shell nav (Users active)
- **Primary content:** paginated user table
- **Primary action:** Create user
- **Secondary actions:** Edit, Activate/Deactivate, Reset password (per row)
- **Loading:** skeleton rows
- **Empty:** "No users yet." (unreachable in practice — the bootstrap admin always exists, but the state must still be handled)
- **Failure:** inline error + retry

### Routes

- **Header:** shell nav (Routes active)
- **Primary content:** paginated route table
- **Primary action:** Create route
- **Secondary actions:** Edit, Activate/Deactivate
- **Loading:** skeleton rows
- **Empty:** "No routes yet."
- **Failure:** inline error + retry

## 14. Open decisions

**No currently blocking product decisions for Phase 6.**

The two decisions previously open here — warehouse review-form persistence, and the operational-day boundary for "Today" counts — are resolved; see §8's Resolved MVP decisions and §5's Resolved MVP decisions respectively. Takeover-notification behavior and dashboard freshness strategy were already answered by root `CLAUDE.md` §19 (no notifications; refetch-on-focus plus a small dashboard polling interval) and needed no separate decision here.

## 15. Approval checklist

Approved by the developer, subject to the two MVP decisions recorded in §5 and §8 above.

- [x] Navigation approved
- [x] Dashboard information approved
- [x] Returns table approved
- [x] Return Details hierarchy approved
- [x] Media display approved
- [x] Review actions approved
- [x] Administration flows approved
- [x] Loading/error/conflict states approved
- [x] Responsive boundary approved
- [x] Phase separation approved

## Future API requirements

High-level backend capabilities future phases will need. No controllers, DTOs, repositories, migrations, services, or OpenAPI changes are made by this checkpoint.

**Already available today** (no new backend work needed for these):

- `POST/GET /api/v1/auth/{login,refresh,logout}`, `GET /api/v1/auth/me` — reusable as-is by the web client.
- `GET/POST/PUT /api/v1/admin/users`, `GET/POST/PUT /api/v1/admin/routes` — reusable as-is for Phase 8.

**Phase 6 (deferred, new):**

- A tenant-scoped, ADMIN-only returns list endpoint with server-side pagination, search, and the filters in §6 (no such endpoint exists yet — only the DRIVER-scoped `/api/v1/driver/returns` exists).
- A tenant-scoped, ADMIN-only return-detail endpoint (equivalent to `GET /api/v1/driver/returns/{returnId}` but without the driver-ownership restriction, scoped to tenant only).
- ADMIN-scoped equivalents of the existing DRIVER-only photo-content and signature-content endpoints (the current `.../photos/{photoId}/content` and `.../signature/content` endpoints are DRIVER-and-owner-scoped only — an ADMIN cannot use them today).
- A dashboard summary-counts endpoint (Waiting Warehouse / In Review / Closed Today / Returns Today) and a Latest Returns endpoint — or the returns-list endpoint above reused with a small page size and no filters for "Latest Returns." "Today" counts must be computed server-side against the Australia/Sydney business day (§5's Resolved MVP decisions), not the browser's timezone.

**Phase 7A (deferred, new):**

- Start Review, Release Review, and (if approved) Take Over Review endpoints with the atomicity/ownership/conflict rules already specified in root `CLAUDE.md` §9.2 and §25.
- **One atomic Close endpoint**, not an incremental save endpoint — per §8's Resolved MVP decisions (no autosave, no draft persistence), the warehouse Yes/No fields, observation, representative name, and signature (representation to be decided — likely the same normalized-vector-strokes approach Phase 5B established for the customer signature, per `CLAUDE.md` §13.1's note that this is "the model for any future signature capture, including the eventual warehouse signature") are all submitted together in the same request that transitions the return to `CLOSED`, enforcing the required-field validation in root `CLAUDE.md` §9.3. No speculative partial-decision or draft-save endpoint is needed for the MVP.
- A Cancel endpoint with the validation rules in root `CLAUDE.md` §9.4.

**Phase 8 (already available — see above):** no new backend work identified beyond what `/api/v1/admin/users` and `/api/v1/admin/routes` already provide.

**Phase 9 (deferred, new):**

- A closed-return PDF-generation endpoint (`GET /api/v1/admin/returns/{returnId}/pdf` per root `CLAUDE.md` §23.2's suggested shape), authorized for closed returns only.
