# ReturnFlow Web — Claude Instructions

> Applies to `apps/web`. Read the root `CLAUDE.md` first.

## Purpose and stack

This React web application is the administrative interface for warehouse staff, managers, supervisors, and owners. All use the `ADMIN` role in V1.

Use React, TypeScript strict mode, Vite, a small routing/data-fetching setup, accessible forms/tables, web signature capture, and server-generated PDF download/print.

Do not use React Native Web to unify the web and mobile UI.

## Required areas

```text
/login
/dashboard
/returns
/returns/:id
/users
/routes
```

Add routes only when they simplify a real flow.

## UX principles

- operational clarity over visual complexity;
- no dashboard charts in V1;
- explicit status labels;
- explicit `Start Review` action;
- opening details never changes status;
- warehouse fields visually separated from driver data;
- destructive actions require confirmation;
- understandable errors;
- form values preserved after recoverable failures;
- loading, empty, and error states;
- desktop-first and reasonably responsive;
- keyboard accessibility and visible focus.

## Dashboard

Show four clickable cards:

- Waiting Warehouse
- In Review
- Closed Today
- Returns Today

Show Latest Returns below.

Do not add charts, trends, financial values, or driver scoring. Simple polling is acceptable; WebSockets and browser push are not.

## Returns list

Support:

- server pagination;
- search by return number, customer, product, driver, and route;
- filters for status, reason, date range, driver, and route;
- clear active filters;
- URL query parameters where practical;
- loading, no-results, and error states.

Recommended columns:

- return number;
- created date/time;
- customer;
- product;
- quantity/unit;
- reason;
- driver;
- route;
- status;
- reviewer when relevant.

## Return details

Show driver data, photos, customer representative/signature, lifecycle, reviewer, warehouse data, and timestamps.

Viewing details must not mutate the return.

## Review flow

### Start Review

Call the backend explicitly. On conflict, refetch and show who owns the review if available. Never overwrite silently.

### Review form

Use explicit Yes/No controls for:

- Sellable
- Credit customer
- Charge customer
- Charge driver

Also capture warehouse observation, representative name, and signature.

Use radio/button groups rather than ambiguous checkboxes for required Yes/No decisions.

### Close

Validate required fields, show a concise confirmation, call the backend, then display the final read-only state and PDF action.

### Release/takeover

Use explicit actions and confirmation. Never silently take ownership.

### Cancel

Require a cancellation reason and clearly distinguish cancellation from deletion.

## Signature capture

Warehouse signature must work with mouse, touchpad, and touchscreen. Provide clear/reset, preview, required validation, and a controlled upload. Avoid keeping base64 data longer than necessary.

Choose a maintained package or small implementation compatible with the current project when this phase is reached.

## PDF

Request the authoritative PDF from the backend. For closed returns show Download PDF and normal browser printing. Do not implement authoritative PDF business logic in the browser. Photos are excluded.

## User management

Allow admins to list/create users, assign route to drivers, activate/deactivate, and trigger the selected password reset/temporary-password flow.

Route is required for drivers and not required for admins. No hard delete. No permission-matrix editor.

## Route management

Allow list/create/edit/activate/deactivate. Show useful validation when a route is assigned to active drivers.

## Authentication

Restore sessions safely, protect admin routes, handle token expiry, log out cleanly, and clear tenant-scoped caches. Authorization remains enforced by the API.

## State and data fetching

Prefer a small standard setup such as TanStack Query for server state and React Hook Form for forms. Do not add Redux by default. Do not duplicate backend lifecycle authority in frontend global state.

## Reusable components

Create components only after reuse is real. Likely examples:

- StatusBadge
- SummaryCard
- ConfirmDialog
- EmptyState
- ErrorState
- LoadingState
- YesNoField
- SignatureField
- ReturnHeader
- PhotoGallery
- PaginatedTable

Do not build a large design system before the pilot.

## Accessibility

Use labels, keyboard access, focus states, adequate contrast, text plus color for statuses, associated form errors, and focus-managed dialogs.

## Testing priorities

Test protected routing, dashboard states, filters, start-review conflict, review validation, signature requirement, close/cancel, non-owner read-only state, and driver-route requirements.

Avoid snapshot-heavy tests.

## Do not

Do not add charts, push, WebSockets, finance/product modules, automatic review on load, shared UI components with React Native, a giant design system, Redux without evidence, client-invented statuses, or browser-generated authoritative PDFs.

## First web milestone

The first milestone only establishes a buildable Vite React TypeScript project, router shell, lint/typecheck/test scripts, environment configuration, and a minimal placeholder shell.
