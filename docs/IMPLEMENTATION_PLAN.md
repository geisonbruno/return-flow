# ReturnFlow — Incremental Implementation Plan

This document defines the ReturnFlow implementation roadmap.

It describes what belongs in each phase, what is excluded, and how completion is evaluated. It does not track current status, approvals, implementation history, commit messages, or commit hashes. Current execution state belongs in the root `progress.md`; historical changes belong in Git.

The project must be developed in small, reviewable phases. Do not ask a coding assistant to build the entire product in one task.

---

## 1. Phase execution rules

Every implementation phase or subphase must:

1. read the root `CLAUDE.md`;
2. read the relevant application-specific `CLAUDE.md` files;
3. read this implementation plan;
4. read the root `progress.md`;
5. inspect the existing repository and uncommitted diff;
6. implement only the requested phase or subphase;
7. run the relevant tests, builds, migrations, and smoke checks;
8. update `progress.md` as **Pending Review**;
9. stop for developer review without committing;
10. be finalized only after explicit developer approval.

A phase prompt may narrow the scope defined here, but it must not silently broaden the phase or contradict the root `CLAUDE.md`.

Do not add planned or actual commit messages to this document.

---

## 2. Roadmap overview

1. Phase 0 — Monorepo scaffold
2. Phase 1 — Backend foundation
3. Phase 2A — Tenant foundation
4. Phase 2B — Authentication
5. Phase 2C — Administration foundation
6. Phase 3A — Return domain model
7. Phase 3B — Driver return API
8. Mobile UX checkpoint
9. Phase 4 — Mobile driver workflow
10. Phase 5A — Return photos
11. Phase 5B — Customer signature
12. Web UX checkpoint
13. Phase 6 — Operational dashboard
14. Phase 7A — Warehouse review backend
15. Phase 7B — Warehouse review web workflow
16. Phase 8 — Administration UI
17. Phase 9 — PDF
18. Phase 10A — CI/CD readiness
19. Phase 10B — Pilot deployment

The UX checkpoints are lightweight product-design gates. They define functional flows before client implementation, but they do not introduce a full visual design system.

---

## 3. Phase 0 — Monorepo scaffold

### Goal

Create a clean, buildable repository skeleton without business features.

### Deliverables

- root directories and source-of-truth documentation;
- standalone Spring Boot API in `apps/api`;
- Vite React TypeScript web app in `apps/web`;
- Expo TypeScript mobile app in `apps/mobile`;
- PostgreSQL and MinIO local infrastructure through Docker Compose;
- `.vscode/tasks.json`;
- root `.editorconfig` and `.gitignore`;
- environment example files;
- independent build, lint, typecheck, and test scripts;
- path-filtered CI foundations where useful.

### Excluded

- authentication;
- tenant behavior;
- users and routes;
- return business logic;
- storage integration;
- production deployment.

### Acceptance criteria

- API builds and its base test passes;
- web builds and typechecks;
- mobile typechecks and its safe noninteractive tests pass;
- Docker Compose configuration validates;
- local commands are documented;
- no secret is committed;
- no business feature is implemented.

---

## 4. Phase 1 — Backend foundation

### Goal

Establish reliable backend infrastructure before introducing business entities.

### Deliverables

- PostgreSQL configuration for explicit local and production profiles;
- Flyway as the only schema migration mechanism;
- Hibernate schema validation without automatic mutation;
- consistent UTC timestamp handling;
- RFC 7807 `ProblemDetail` error structure;
- OpenAPI documentation foundation;
- Actuator health and info endpoints;
- Testcontainers-based PostgreSQL integration-test strategy;
- build and local smoke-test documentation.

### Excluded

- tenant entity or tenant resolution;
- authentication and authorization;
- users and routes;
- return domain;
- storage and PDF.

### Acceptance criteria

- migrations execute against a real PostgreSQL instance;
- Hibernate validation succeeds;
- API tests and package build pass;
- health endpoint reports database health;
- OpenAPI is available;
- the application fails fast without an explicit database profile;
- no business entity is introduced.

---

## 5. Phase 2A — Tenant foundation

### Goal

Create the minimum infrastructure required for every future request to execute inside a tenant context.

### Deliverables

- `Tenant` entity and status enum;
- Flyway migration for the tenant table;
- tenant repository;
- idempotent bootstrap of the default `Warehouse` tenant;
- `TenantContext` with encapsulated storage;
- `TenantResolver` abstraction;
- temporary default resolver for the bootstrapped tenant;
- request filter that sets and always clears the context;
- reusable `createdAt` and `updatedAt` auditing support;
- tests for context behavior, filter cleanup, and bootstrap idempotency.

### Excluded

- authentication;
- users, roles, and routes;
- JWT or refresh tokens;
- client-provided tenant selection;
- return domain;
- tenant isolation tests involving business data;
- storage and PDF.

### Acceptance criteria

- application starts successfully;
- tenant migration executes;
- exactly one default `Warehouse` tenant exists after repeated startup;
- every normal HTTP request passes through tenant resolution;
- tenant context is cleared after successful and failed requests;
- existing tests remain green;
- no future business capability is introduced.

---

## 6. Phase 2B — Authentication

### Goal

Implement secure tenant-aware authentication without administration CRUD.

### Deliverables

- tenant-owned `User` entity;
- roles `DRIVER` and `ADMIN`;
- globally unique normalized email for V1 login;
- modern adaptive password hashing;
- Spring Security configuration;
- short-lived access tokens;
- refresh-token persistence, rotation, expiration, revocation, and logout behavior;
- login endpoint;
- refresh endpoint;
- logout endpoint;
- authenticated `/auth/me` endpoint;
- controlled bootstrap of the first Warehouse admin using environment-provided credentials or another explicitly approved secure mechanism;
- authenticated principal containing trusted user, role, and tenant information;
- tenant context resolution from the authenticated principal for protected requests;
- authentication failure handling using the project `ProblemDetail` conventions;
- focused authentication and security integration tests.

### Required security behavior

- passwords are never stored or logged in plaintext;
- tokens and refresh-token secrets are never logged;
- inactive users cannot authenticate or refresh;
- refresh tokens rotate and old tokens cannot be reused;
- logout revokes the relevant refresh-token session;
- tenant and role claims originate from trusted server data;
- authentication requests do not accept a tenant ID;
- protected endpoints cannot switch tenant through JSON, query parameters, or headers.

### Excluded

- user CRUD;
- route entity or route assignment;
- password-reset email delivery;
- web or mobile login screens;
- return domain;
- general permission hierarchy beyond `DRIVER` and `ADMIN`.

### Acceptance criteria

- first admin can be bootstrapped safely;
- valid credentials return an access/refresh session;
- invalid credentials produce a safe consistent error;
- `/auth/me` returns the authenticated user contract without exposing secrets;
- refresh rotation and logout revocation are proven by tests;
- tenant context is derived from authenticated server data on protected requests;
- a token cannot be used to select or access another tenant;
- API tests and build pass.

---

## 7. Phase 2C — Administration foundation

### Goal

Provide backend administration for users and routes inside one tenant.

### Deliverables

- tenant-owned `Route` entity;
- route code/name and active state;
- one nullable route assignment on `User`;
- admin-only user list, create, update, activate, and deactivate operations;
- admin-only route list, create, update, activate, and deactivate operations;
- driver route assignment;
- validation preventing invalid active-driver route state;
- one controlled temporary-password or reset workflow without email delivery unless explicitly added later;
- explicit DTOs and `ProblemDetail` errors;
- server-side authorization for all admin operations;
- meaningful tenant-isolation integration tests using at least two tenants;
- route and user repository queries scoped by tenant.

### Excluded

- administration web UI;
- email delivery;
- route history beyond what future return snapshots require;
- multiple routes per driver;
- return reasons and returns;
- advanced role permissions.

### Acceptance criteria

- an admin can manage users and routes only inside their tenant;
- a driver has one active route before operational use;
- deactivation rules preserve valid active-driver state or return a clear validation error;
- no cross-tenant user or route can be read or modified;
- inactive users cannot authenticate;
- API tests and build pass.

---

## 8. Phase 3A — Return domain model

### Goal

Introduce the core return domain and persistence model without controllers or client features.

### Deliverables

- tenant-owned `ReturnReason` entity;
- seeded default Warehouse reasons from the root `CLAUDE.md`;
- `ProductReturn` or `ReturnRecord` entity with an explicit domain name;
- return status and unit enums;
- driver, route, and route-snapshot relationships;
- customer, product, quantity, reason, and observation fields;
- customer representative name field;
- lifecycle ownership and warehouse decision fields required by the final domain;
- cancellation metadata;
- optimistic-lock version;
- transaction-safe tenant/year return-number generation;
- Flyway migrations, constraints, indexes, and foreign keys;
- repositories with tenant-aware query foundations;
- domain validation and persistence tests.

Media metadata and object storage may be introduced in Phase 5A rather than speculatively here.

### Excluded

- driver or admin controllers;
- mobile or web UI;
- object storage;
- photos and signature image handling;
- PDF generation;
- warehouse review services.

### Acceptance criteria

- schema migration succeeds;
- seeded reasons are idempotent;
- `OTHER` is represented as a reason that requires details;
- return number generation is unique inside tenant/year under concurrent creation tests;
- optimistic locking is configured;
- repositories cannot accidentally expose unscoped tenant-owned data;
- API tests and build pass.

---

## 9. Phase 3B — Driver return API

### Goal

Implement the tenant- and driver-scoped non-media return workflow.

### Deliverables

- active-reasons endpoint;
- driver list of only their own returns;
- driver return detail;
- create return with non-media fields;
- update return while status is `WAITING_WAREHOUSE`;
- route derived from the authenticated driver and stored as a snapshot;
- backend-generated tenant, driver, timestamps, status, and return number;
- validation for customer, product, quantity, unit, reason, and conditional `OTHER` details;
- ownership and tenant checks;
- pagination and stable response DTOs;
- clear conflict behavior for stale version or status changes;
- tests for tenant isolation, driver ownership, validation, and lifecycle restrictions.

This phase is an internal incremental slice. The pilot flow is not considered complete until customer signature and media requirements are enforced in Phase 5.

### Excluded

- photo upload;
- signature image upload;
- warehouse review;
- admin dashboard;
- PDF;
- permanent delete;
- offline behavior.

### Acceptance criteria

- drivers can read only their own returns;
- drivers cannot submit tenant, driver, or route IDs;
- drivers cannot edit after review begins;
- `OTHER` requires details;
- invalid or cross-tenant IDs behave as not found where appropriate;
- stale updates return a clear conflict;
- API tests and build pass.

---

## 10. Mobile UX checkpoint

### Goal

Approve the minimum functional mobile experience before building the driver application.

### Required output

Create or update a concise mobile UX document covering:

- login and session restoration;
- My Returns;
- New Return;
- field order and grouping;
- reason `OTHER` behavior;
- quantity and EA/CTN selection;
- customer representative and signature flow;
- photo capture/selection flow;
- review/confirmation before submission;
- edit versus read-only behavior;
- loading, empty, validation, network-failure, conflict, and success states;
- large touch targets and minimum interaction count.

### Boundaries

- no final branding system;
- no animation work;
- no dark mode unless later proven necessary;
- no visual polish that delays the workflow;
- no implementation until the developer approves the functional flow.

---

## 11. Phase 4 — Mobile driver workflow

### Goal

Implement the authenticated non-media driver experience using the approved mobile UX flow.

### Deliverables

- login;
- secure mobile token storage through Expo SecureStore;
- session restoration and logout;
- My Returns list;
- return detail;
- New Return form;
- edit while `WAITING_WAREHOUSE`;
- reasons loading;
- quantity and EA/CTN selection;
- observations and customer representative name;
- status and read-only behavior;
- clear validation, loading, empty, network-failure, conflict, and success states;
- automatic refresh when warehouse review makes a return read-only;
- focused mobile tests.

### Excluded

- photo capture;
- customer signature drawing;
- offline queues;
- push notifications;
- final visual design system.

### Acceptance criteria

- a driver authenticates and restores a session securely;
- a driver sees only their own returns;
- the form follows the approved UX order;
- the app never sends tenant, driver, or route IDs;
- conflicts stop editing and refresh authoritative backend state;
- network failure never reports false success;
- typecheck and mobile tests pass.

### Phase 4.1 — Product identification correction

Real manual use of the application after Phase 4 showed that a return needs an explicit product identity separate from the free-text observation field, or drivers must conflate the two. Phase 4.1 (tracked in `progress.md`, not a renumbered roadmap entry) adds a required `productName` field — free text, one product per return, immutable after creation, no product catalog, SKU, or barcode — to the driver return API, database, and the mobile New Return form, My Returns list, and Return Details screens described above. It does not change this phase's original acceptance criteria and does not add photos, signatures, editing, or any Phase 5+ capability.

---

## 12. Phase 5A — Return photos

Corrected split (tracked in `progress.md`, not a renumbered roadmap entry): Phase 5 is split by **feature**, not by layer — 5A delivers the complete photo vertical slice (backend and mobile together); 5B delivers the complete customer-signature vertical slice. The originally planned backend/mobile layer split, and remove/replace photo operations, are superseded by this section.

### Goal

Let a DRIVER attach zero to five JPEG photos to their own return, establishing a small, reusable media-storage foundation Phase 5B can reuse for the customer signature.

### Deliverables

- `storage.ReturnMediaStorage` interface (store/read a binary object) separating PostgreSQL metadata from binary content;
- a filesystem-backed adapter for this MVP, behind that same interface, so it can later be replaced by a Cloudflare R2/S3-compatible adapter without changing calling code (no MinIO/cloud adapter in this phase);
- `ReturnPhoto` metadata and one migration;
- DRIVER-only, tenant- and driver-scoped upload/list/content endpoints — one photo uploaded per request;
- server-generated storage keys and photo position; maximum five photos per return, enforced correctly under concurrent uploads;
- accepted-content-type (`image/jpeg` only) and file-size (5 MB) validation, independent of the client;
- immutable photo records — no update/delete/replace endpoint in this phase;
- mobile JPEG normalization (resize/compress) before upload;
- `AddReturnPhotosScreen` (library selection, camera capture where available, local preview, upload progress, retry, Skip/Finish) reachable right after creating a return and again from Return Details;
- a lightweight photo-count indicator on My Returns and Return Details;
- authorization and storage-adapter tests.

### Excluded

- customer signature (Phase 5B);
- warehouse signature;
- PDF;
- public object URLs or tokens in a query string;
- base64 image storage in PostgreSQL or in `ReturnResponse`;
- photo deletion or replacement;
- a DRAFT return status or a separate submission endpoint;
- offline upload queues, background sync, push notifications.

### Acceptance criteria

- storage keys are always server-generated, never a client filename, and stay inside the configured storage root;
- every object path and every photo record is tenant- and return-scoped;
- cross-tenant and cross-driver access (including a different driver on the same route) behaves as not found;
- a sixth photo is rejected, correctly even under concurrent uploads;
- invalid type/size is rejected safely, without leaking a filesystem path or storage key;
- photo binary content is reachable only through an authenticated endpoint;
- mobile normalizes every upload to JPEG before sending it;
- a failed photo upload never duplicates the underlying return;
- API and mobile tests pass.

---

## 13. Phase 5B — Customer signature

The customer-signature vertical slice (drawn signature, customer representative name, required before the driver's record is considered complete per root `CLAUDE.md` §13), reusing the `storage.ReturnMediaStorage` abstraction Phase 5A established. Warehouse signature remains a separate, later phase (web review workflow), not part of 5B.

### Goal

Let a DRIVER capture one customer signature per return, using normalized vector strokes rather than a client-generated image, completing the primary new-return workflow (Create Return → Add Photos → Customer Signature → Return Details).

### Deliverables

- one `ReturnSignature` metadata table/migration, immutable, at most one per return;
- a small server-side SVG-rendering component that converts validated normalized stroke points into a sanitized `image/svg+xml` document — no client-supplied image, Base64, or markup is ever stored;
- DRIVER-only, tenant- and driver-scoped create/metadata/content endpoints, safe under concurrent submission (same row-locking pattern as Phase 5A's photo uploads);
- signer-name and stroke validation (length, point/stroke counts, coordinate bounds, a minimum drawn-length threshold to reject a blank tap), enforced server-side regardless of client checks;
- `ReturnResponse.signature`, nullable, reflecting pending vs. captured state;
- a cross-platform (native + Expo Web) `SignaturePad` built on `react-native-svg` and `PanResponder` — not a WebView-based signature library;
- `CustomerSignatureScreen`, reachable after Add Photos for a newly created return and again from Return Details while a signature is still pending;
- a lightweight signature-status indicator on My Returns and a Signature section on Return Details, so an interrupted workflow is easy to resume;
- authorization, validation, SVG-safety, and concurrency tests.

### Excluded

- warehouse signature (a later, separate phase);
- signature replacement or deletion;
- multiple signatures per return;
- remote authenticated rendering of the signature image itself (metadata only in this phase);
- PDF generation;
- a DRAFT return status or any change to existing return statuses.

### Acceptance criteria

- a return has zero or one signature, never more, correctly even under concurrent submission attempts;
- the backend never accepts a client-supplied image, Base64 payload, or raw SVG/HTML — only normalized stroke points and a signer name;
- the generated SVG contains no scripts, external resources, or client-provided markup;
- signature content is reachable only through an authenticated endpoint;
- cross-driver and cross-tenant access to signature endpoints behaves as not found;
- an interrupted workflow (return created, signature not yet captured) is visible and resumable from Return Details and My Returns;
- existing photo, product-identification, tenant-isolation, and authentication behavior are unaffected;
- API and mobile tests pass.

---

## 14. Web UX checkpoint

### Goal

Approve the minimum functional admin experience before building dashboard and review screens.

### Required output

Create or update a concise web UX document covering:

- admin login and session behavior;
- operational summary cards;
- Latest Returns;
- returns table, search, filters, pagination, and empty states;
- return detail information hierarchy;
- explicit Start Review action;
- active-review ownership visibility;
- warehouse review form field order;
- release, takeover, close, and cancel confirmations;
- warehouse signature interaction;
- user and route management flows;
- loading, validation, conflict, permission, and failure states;
- desktop-first responsive behavior suitable for warehouse use.

### Boundaries

- no charts;
- no full design system;
- no speculative analytics;
- no animation work that delays validation;
- no implementation until the developer approves the functional flow.

---

## 15. Phase 6 — Operational dashboard

### Goal

Give admins tenant-scoped visibility into return operations.

### Deliverables

- admin login and session restoration for web;
- operational summary cards:
  - Waiting Warehouse;
  - In Review;
  - Closed Today;
  - Returns Today;
- Latest Returns;
- server-paginated returns list;
- global search by return number, customer, product, driver, and route;
- filters for status, reason, date range, driver, and route;
- return detail view;
- photo and customer signature display;
- current status, reviewer, and relevant timestamps;
- polling-based refresh and in-app feedback where useful;
- web tests for authentication, filters, lists, and states.

### Excluded

- warehouse editing and close actions;
- charts;
- real-time WebSockets;
- push notifications;
- user and route management UI;
- PDF generation.

### Acceptance criteria

- admins see only their tenant's data;
- summary-card navigation applies the correct list filter;
- search and pagination are server-side;
- opening details does not start a review;
- driver-only fields and admin-visible fields follow the source of truth;
- web lint, typecheck, tests, and build pass.

---

## 16. Phase 7A — Warehouse review backend

### Goal

Implement the complete server-authoritative warehouse lifecycle and concurrency rules.

### Deliverables

- explicit atomic Start Review operation;
- review owner and timestamp;
- release review operation;
- explicit takeover behavior with confirmation metadata if approved;
- warehouse decision fields;
- warehouse observation and representative name;
- warehouse signature backend storage;
- close validation;
- cancel with required reason, actor, and timestamp;
- terminal immutability for `CLOSED` and `CANCELLED`;
- optimistic-lock and ownership conflict handling;
- appropriate conflict and validation `ProblemDetail` responses;
- lifecycle and concurrency tests.

### Excluded

- web review form;
- reopen operation;
- permanent delete;
- financial calculations;
- notifications;
- PDF.

### Acceptance criteria

- two admins cannot silently claim or overwrite the same review;
- only the current reviewer can update warehouse fields unless an approved takeover occurs;
- close requires every mandatory warehouse field and signature;
- cancelled and closed returns are immutable;
- driver editing stops as soon as review begins;
- tenant isolation is proven;
- API tests and build pass.

---

## 17. Phase 7B — Warehouse review web workflow

### Goal

Implement the approved admin review experience over the Phase 7A API.

### Deliverables

- explicit Start Review action;
- review ownership and read-only state for other admins;
- warehouse Yes/No fields;
- warehouse observation;
- representative name;
- drawn warehouse signature with preview, clear, redo, and confirmation;
- release review;
- approved takeover flow when applicable;
- close flow;
- cancel flow with required reason;
- conflict recovery and authoritative refresh;
- terminal read-only views;
- focused web tests.

### Excluded

- reopening;
- PDF generation;
- push notifications;
- financial calculations;
- visual polish beyond the approved functional UX.

### Acceptance criteria

- viewing details alone never claims a return;
- active reviewer ownership is clear;
- another admin cannot silently overwrite work;
- required fields and signature are enforced before close;
- conflicts refresh backend-authoritative state;
- closed and cancelled returns are read-only;
- web checks pass.

---

## 18. Phase 8 — Administration UI

### Goal

Allow the first admin to operate users and routes without developer intervention.

### Deliverables

- users list and create flow;
- user update, activate, and deactivate actions;
- role selection limited to `DRIVER` and `ADMIN`;
- driver route assignment;
- controlled temporary-password or reset UX matching Phase 2C;
- routes list and create/edit flow;
- route activate/deactivate actions;
- clear validation and dependency errors;
- permission and tenant-scoped behavior;
- focused web tests.

### Excluded

- tenant management UI;
- reason management UI;
- email automation unless separately approved;
- hard deletion;
- complex permissions;
- multi-route drivers.

### Acceptance criteria

- an admin can configure routes and operational users;
- no admin can manage another tenant;
- deactivation does not silently create invalid driver state;
- hard delete is unavailable;
- web checks pass.

---

## 19. Phase 9 — PDF

### Goal

Preserve the required printable record without copying the paper workflow into the product.

### Deliverables

- commercially compatible PDF library selected after license review;
- backend-generated PDF from trusted database data;
- authorization limited to appropriate admins and closed returns;
- tenant/ReturnFlow branding;
- return, driver, route, reason, lifecycle, and warehouse fields;
- customer and warehouse representative names and signatures;
- creation and close timestamps;
- photos excluded;
- on-demand generation without permanent storage unless later justified;
- web download and print action;
- PDF-content and authorization tests.

### Excluded

- photos in PDF;
- PDF generation during close;
- bulk export;
- invoice/accounting output;
- automatic email delivery.

### Acceptance criteria

- only a closed return can produce the administrative PDF;
- PDF data comes from the database, not client-provided display state;
- both signatures render correctly;
- photos are absent;
- output is printable on standard paper;
- library licensing is documented as compatible;
- relevant tests and builds pass.

---

## 20. Phase 10A — CI/CD readiness

### Goal

Make every application independently verifiable and deployable without requiring an IDE.

### Deliverables

- path-filtered GitHub Actions for API, web, and mobile;
- API tests and package build;
- web lint, typecheck, test, and build;
- mobile typecheck, lint, and tests on a supported Node version;
- safe environment-variable documentation;
- production build configuration;
- deployment gates requiring successful checks;
- artifact and dependency caching where simple and useful.

### Excluded

- production data migration;
- pilot user onboarding;
- provider assumptions that have not been revalidated;
- Kubernetes or complex orchestration.

### Acceptance criteria

- each workflow runs only for relevant paths;
- failures block deployment;
- no secret is committed or printed;
- builds run without opening an IDE;
- workflow results are reproducible.

---

## 21. Phase 10B — Pilot deployment

### Goal

Deploy a safe initial Warehouse pilot.

### Pre-deployment requirement

Revalidate current provider pricing, limits, regions, reliability, and commercial suitability immediately before implementation.

### Deliverables

- managed API deployment;
- managed PostgreSQL;
- web deployment;
- Cloudflare R2-compatible object storage;
- production secrets;
- CORS and trusted-origin configuration;
- health checks;
- database backups and recovery notes;
- controlled bootstrap of the Warehouse tenant and first admin;
- routes, admins, drivers, and reason seed verified;
- smoke-test checklist;
- basic support and recovery process;
- pilot observability using provider logs and health endpoints.

### Excluded

- public tenant signup;
- subscription billing;
- multiple production tenants before the first pilot is validated;
- advanced observability platform;
- VPS/Kubernetes unless current revalidation proves them necessary.

### Acceptance criteria

- mobile can create a complete signed return in the pilot environment;
- an admin can find, review, close, cancel, and print according to permissions;
- no driver sees warehouse-only fields;
- tenant isolation tests pass in production-equivalent configuration;
- backup and recovery steps exist;
- critical error paths are smoke-tested;
- no production secret appears in source control or logs.

---

## 22. Pilot readiness checklist

Before real operational use, confirm:

- tenant isolation is verified;
- authentication, refresh rotation, logout, and inactive-user rules work;
- the first Warehouse admin exists;
- routes are configured;
- drivers are created and assigned to active routes;
- default reasons are correct;
- mobile creates a complete return with required customer signature;
- zero to five photos work;
- drivers see only their own returns;
- admins see only their tenant;
- Start Review is explicit and atomic;
- review ownership and conflicts work;
- admin can close and cancel correctly;
- terminal records are immutable;
- PDF prints correctly and excludes photos;
- backups exist;
- critical error paths are tested;
- recovery and support steps are documented.

---

## 23. Post-pilot discovery

After real usage, collect:

- average time to create a return;
- fields drivers or admins misunderstand;
- frequency and content patterns of `OTHER`;
- photo usage;
- cancellation causes;
- review bottlenecks;
- frequency of abandoned reviews or takeovers;
- demand for notifications;
- demand for offline support;
- ERP and product-catalog integration demand;
- value of visual UI refinement after functional validation.

Do not add these capabilities before observing the pilot unless a blocking operational requirement is proven.

Possible post-pilot work includes UI polish, branding refinement, a small reusable design system, additional reporting, self-service tenant onboarding, billing, notifications, offline support, and ERP integrations. These remain candidates rather than commitments.
