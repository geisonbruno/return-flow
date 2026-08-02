# ReturnFlow — Project Source of Truth

> This file is the primary source of truth for the ReturnFlow product and monorepo.
> Claude Code and every contributor must read this file before changing the project.
> More specific instructions exist inside `apps/api`, `apps/web`, and `apps/mobile`.

---

## 1. Product identity

**Product name:** ReturnFlow
**Repository name:** `returnflow`
**Initial tenant:** Warehouse
**Product type:** Multi-tenant B2B SaaS, initially validated as an internal operational tool
**Primary problem:** Replace paper-based product return forms, daily photos, and fragmented WhatsApp explanations with one traceable digital workflow.

ReturnFlow manages the operational flow of a product return from the driver who records it to the warehouse/admin user who reviews and closes it.

The product must be designed for SaaS evolution, but the first version must remain small, inexpensive, and focused on validating the real initial warehouse workflow.

---

## 2. Why the product exists

The current process uses a paper return sheet. The driver manually writes return details, asks the customer to sign, and later sends photos or explanations. Warehouse staff then review the return and complete administrative fields.

This creates several problems:

- handwriting can be incomplete or hard to read;
- photos and explanations are distributed across paper and messaging apps;
- the same customer name is repeatedly written for separate products;
- returns are difficult to search later;
- there is no reliable status or ownership of the review;
- the paper form mixes driver and warehouse responsibilities;
- historical reporting is inconsistent because return reasons are free text;
- paper layout constraints influence the process even when they should not influence the software.

ReturnFlow must digitize the process, not copy the paper layout literally.

---

## 3. Product hypothesis

The MVP validates the following hypothesis:

> Drivers and warehouse staff will adopt a lightweight digital return workflow when it is faster and clearer than the existing paper process and still supports printable records when required.

Early validation is successful when:

- drivers can create complete returns without relying on paper;
- warehouse users can find, review, close, and print returns;
- the workflow reduces missing information and repeated explanations;
- the initial warehouse operation can use the product in real daily operations;
- the architecture does not require a rewrite to add a second tenant.

Exact numeric success targets may be defined after the first pilot.

---

## 4. Product principles

All implementation decisions must follow these principles.

1. **MVP before platform.** Build only what is required to validate the operational workflow.
2. **The interface must be simpler than paper.**
3. **Model the real process, not the physical form.**
4. **One return represents one customer, one product, and one reason.**
5. **The driver records operational facts. Warehouse/admin users complete administrative decisions.**
6. **Drivers never see warehouse-only financial or administrative fields.**
7. **The product is multi-tenant from the beginning, even with one initial tenant.**
8. **Tenant isolation is a security boundary, not merely a UI filter.**
9. **No permanent deletion of returns.**
10. **Prefer explicit workflows and small modules over generic abstractions.**
11. **Avoid microservices, event buses, Kubernetes, and unnecessary infrastructure in V1.**
12. **Keep cloud providers replaceable through clear interfaces and environment configuration.**
13. **Use the same product code for the initial Warehouse tenant and future customers; Warehouse is a tenant, not a custom fork.**
14. **Every user should see only the information and actions required for their role.**
15. **Development must happen incrementally with small, reviewable commits.**
16. **Do not build the entire specification in one implementation step.**
17. **Do not add a feature merely because it may be useful for a future SaaS version.**

---

## 5. Product language

The user-facing product language for V1 is **English**, because the initial company operates in Australia.

Code, database names, API fields, and technical documentation must also use English.

The product name is written as **ReturnFlow**.

---

## 6. Users and roles

V1 has two roles only.

### 6.1 DRIVER

The driver uses the React Native mobile app.

The driver can:

- authenticate with email and password;
- view only their own returns;
- create a return;
- edit a return while its status is `WAITING_WAREHOUSE`;
- add up to five photos;
- collect the customer representative name and signature;
- view return status and details.

The driver cannot:

- view returns belonging to other drivers;
- access warehouse fields;
- start a warehouse review;
- close a return;
- cancel a return;
- delete a return;
- manage users, routes, reasons, or tenants;
- generate the administrative PDF.

### 6.2 ADMIN

Warehouse staff, managers, supervisors, and owners use one shared role: `ADMIN`.

V1 intentionally does not create a permission hierarchy between warehouse, manager, and boss.

An admin can:

- view all returns inside their tenant;
- search and filter returns;
- start a review;
- complete warehouse fields;
- close or cancel a return;
- print or download a PDF for a closed return;
- create, deactivate, and reactivate users;
- create, edit, and deactivate routes;
- view the operational summary;
- view other admins' review ownership.

An admin cannot access data from another tenant.

---

## 7. Tenant onboarding

### 7.1 Initial Warehouse pilot

The initial Warehouse tenant and first admin are created through a controlled bootstrap process during deployment.

The first admin then creates:

- additional admins;
- drivers;
- routes used by the drivers.

### 7.2 Future SaaS onboarding

Future self-service SaaS onboarding will automatically create:

- the tenant;
- the first admin;
- the subscription relationship;
- default return reasons;
- initial company settings.

Self-service signup and billing are outside V1.

---

## 8. Core domain rule

A ReturnFlow return is not a paper row and is not a shipment containing multiple products.

A return always represents:

```text
1 customer
+ 1 product
+ 1 quantity and unit
+ 1 return reason
+ 1 customer acknowledgement
+ 1 independent status
```

If the same customer returns three products, the system creates three independent returns.

This is intentional because each product can have:

- a different reason;
- different photos;
- a different quantity;
- different warehouse decisions;
- a different lifecycle;
- a separate printable record.

The web interface may group or visually filter returns by customer, but the records remain independent.

---

## 9. Return lifecycle

The V1 lifecycle is:

```text
WAITING_WAREHOUSE
        |
        v
IN_REVIEW
   |        |
   v        v
CLOSED   CANCELLED
```

An admin may also cancel directly from `WAITING_WAREHOUSE`.

### 9.1 WAITING_WAREHOUSE

This is the initial persisted status after the driver creates a return.

Rules:

- the driver may edit the return;
- the assigned driver can view it;
- admins can view it;
- warehouse-only fields remain unavailable to the driver;
- an admin may explicitly click `Start Review`;
- simply opening the details page must not start the review.

### 9.2 IN_REVIEW

When an admin clicks `Start Review`:

- the status becomes `IN_REVIEW`;
- `reviewStartedBy` and `reviewStartedAt` are recorded;
- the return becomes read-only for the driver;
- only the reviewing admin may modify warehouse fields;
- other admins may view the return;
- the review can be explicitly released back to `WAITING_WAREHOUSE`;
- an explicit admin takeover may be supported with confirmation and audit metadata if required to avoid abandoned locks.

Starting a review must be an atomic backend operation.

### 9.3 CLOSED

A return can be closed only from `IN_REVIEW`.

Closing requires all mandatory warehouse fields.

After closing:

- driver fields become immutable;
- warehouse fields become immutable;
- PDF generation becomes available;
- the return remains searchable indefinitely;
- reopening is outside V1.

### 9.4 CANCELLED

Only an admin may cancel.

Rules:

- cancellation reason is required;
- cancellation records actor and timestamp;
- cancelled returns remain searchable;
- cancelled returns are immutable;
- cancellation is not deletion.

### 9.5 No delete operation

No API, web action, or mobile action may permanently delete a return in V1.

---

## 10. Return reasons

Reasons are stored as tenant-owned configuration records so they can be customized in a future version.

V1 does not include a reason-management screen. Default reasons are seeded for the initial Warehouse tenant.

| Code | Display label | Meaning |
|---|---|---|
| `WRONG_ITEM_DELIVERED` | Wrong item delivered | The customer ordered one product but a different product was delivered. |
| `EXTRA_ITEM` | Extra item | An extra product or quantity was delivered. |
| `MISSING_ITEM` | Missing item | A product or quantity is missing. |
| `CUSTOMER_CHARGE_REQUIRED` | Customer needs to be charged | A rare operational reason used when the manager instructs the driver to record that the customer needs to be charged for the item. |
| `NO_LONGER_REQUIRED` | No longer required | The customer no longer needs the product. |
| `WRONG_ITEM_ORDERED` | Wrong item ordered | The order itself contained the incorrect product. |
| `EXCHANGE_REQUIRED` | Exchange required | The product needs to be exchanged. |
| `DAMAGED` | Damaged | The product or packaging is damaged. |
| `LEAKING` | Leaking | The product is leaking. |
| `NOT_ORDERED` | Not ordered | The customer states that the product was not ordered. |
| `OTHER` | Other | The situation does not fit an existing predefined reason. |

### 10.1 Other reason behavior

The driver does not create a new permanent option.

When `OTHER` is selected:

- a free-text `reasonDetails` field appears;
- `reasonDetails` becomes mandatory;
- the selected reason remains `OTHER`;
- the description is saved with the return;
- admins may later analyze repeated descriptions and decide whether to add a future predefined reason.

For all other reasons, `reasonDetails` is optional and normally hidden.

### 10.2 Charge distinction

`CUSTOMER_CHARGE_REQUIRED` is kept as a driver-visible reason because it reflects an existing real-world instruction from the manager.

It does not automatically make a financial decision.

During warehouse review, the admin still explicitly answers `Charge customer: Yes/No`.

---

## 11. Driver return form

### 11.1 System-generated fields

The system generates or derives:

- return ID;
- human-readable return number;
- tenant;
- driver;
- route;
- creation date and time;
- initial status;
- created/updated timestamps;
- record version for optimistic concurrency.

### 11.2 Driver-entered fields

Required unless marked otherwise:

- `customerName` — required text;
- `productName` — required text, free text, one product per return;
- `quantity` — required positive integer;
- `unit` — required enum: `EA` or `CTN`;
- `reasonId` — required;
- `reasonDetails` — required only when reason is `OTHER`;
- `driverObservation` — optional multiline text;
- photos — optional, maximum five;
- `customerRepresentativeName` — required;
- customer signature — required.

### 11.3 Quantity and unit

V1 supports only:

- `EA` — individual units;
- `CTN` — cartons.

Quantity must be a positive integer. Decimal quantities, kilograms, packs, and other units are outside V1.

### 11.4 Product

There is no product catalog in V1.

The driver enters a free-text `productName`. This field is required, immutable after the return is created, and limited to one product per return, consistent with the domain rule in §8.

Future ERP integration may replace or augment this field.

### 11.5 Route

A driver belongs to one active route.

The driver does not select or type the route when creating a return.

The system takes the route from the authenticated driver's profile and stores a route snapshot with the return so historical records remain accurate if the driver's route changes later.

---

## 12. Warehouse review form

The warehouse/admin review preserves the useful fields from the paper form while excluding unused or redundant fields.

Required to close:

- `sellable` — Yes/No;
- `creditCustomer` — Yes/No;
- `chargeCustomer` — Yes/No;
- `chargeDriver` — Yes/No;
- `warehouseRepresentativeName` — required;
- warehouse signature — required.

Optional:

- `warehouseObservation` — multiline text.

Automatically recorded:

- reviewing admin account;
- review start timestamp;
- closing admin account;
- close timestamp.

### 12.1 Explicitly excluded paper fields

The following paper fields are not part of V1:

- `Returned? Yes/No` — redundant because the record itself is a return;
- `Invoice Today/Previous` — not used in the current daily process;
- direct financial calculations or accounting entries;
- product pricing;
- invoice integration.

---

## 13. Signatures

Both signatures are drawn in the application:

- customer signature on mobile using touch;
- warehouse signature on web using mouse, touchpad, or touchscreen.

Signatures are stored as image objects in object storage, not as base64 strings in PostgreSQL.

Requirements:

- transparent or white background PNG;
- reasonable size limits;
- signature preview before confirmation;
- clear and redo actions;
- signature metadata linked to the return;
- signature images included in the PDF;
- signature objects isolated by tenant and return.

A typed name is required in addition to each signature.

---

## 14. Photos

A return may contain zero to five photos.

Requirements:

- accepted image formats must be explicitly validated;
- mobile should resize/compress large photos before upload;
- file size limits must exist on both client and server;
- original client filenames must not be used as storage keys;
- object storage keys must be generated by the backend;
- photos remain visible in the system;
- photos are not included in the printable PDF;
- removing or replacing photos is allowed only while the driver may edit the return;
- after `IN_REVIEW`, photos are immutable.

Production storage target: Cloudflare R2.
Local development target: an S3-compatible local service such as MinIO.

Cloud provider access must be behind an application storage interface.

---

## 15. Human-readable return number

Every return receives a human-readable number.

Recommended format:

```text
RF-2026-000123
```

Requirements:

- unique inside a tenant;
- safe under concurrent creation;
- generated by the backend;
- searchable;
- included in lists, details, and PDF;
- internal UUID remains the primary technical identifier.

A tenant/year counter or another transaction-safe implementation may be used.

---

## 16. Mobile application scope

Required screens:

1. Splash/session restoration
2. Login
3. My Returns
4. New Return
5. Return Details / Edit Return
6. Customer Signature
7. Photo capture/selection flow
8. Status/read-only view

### 16.1 My Returns

The driver sees only their own returns.

The list should display:

- return number;
- customer;
- product;
- reason;
- status;
- creation date/time.

Useful filters may include status and date, but the first implementation should remain simple.

### 16.2 New Return

The form should prioritize speed and large touch targets.

The form is one return per screen, not multiple paper-style rows.

### 16.3 Edit behavior

Editing is enabled only when status is `WAITING_WAREHOUSE`.

When the backend returns a conflict or the status changed to `IN_REVIEW`, the app must:

- stop editing;
- refresh the return;
- show a clear message that warehouse review has started.

### 16.4 No offline mode

Offline creation, local queues, and background synchronization are outside V1.

The app must handle network errors clearly and never falsely report a successful submission.

---

## 17. Web application scope

Required areas:

1. Login
2. Operational Summary
3. Returns List
4. Return Details
5. Review Mode
6. Closed Return / PDF action
7. User Management
8. Route Management

### 17.1 Operational Summary

No charts in V1.

Use four concise clickable cards:

- Waiting Warehouse
- In Review
- Closed Today
- Returns Today

Below the cards, show `Latest Returns`.

Clicking a card opens the returns list with the corresponding filter.

### 17.2 Returns list

Global tenant-scoped search supports:

- return number;
- customer;
- product;
- driver;
- route.

Filters support:

- status;
- reason;
- date range;
- driver;
- route.

The first version should use server-side pagination.

### 17.3 Return details

Display:

- driver fields;
- photos;
- customer representative and signature;
- lifecycle/status;
- warehouse fields when applicable;
- current reviewer;
- relevant timestamps.

Simply viewing details must not start a review.

### 17.4 Review mode

An explicit `Start Review` action claims the return.

The reviewing admin may:

- complete required Yes/No decisions;
- enter warehouse observation;
- enter representative name;
- draw signature;
- close the return;
- release the review;
- cancel with a reason.

Other admins may view but must not silently overwrite the active review.

### 17.5 Users

An admin can:

- create driver or admin users;
- set full name and email;
- assign one route to a driver;
- activate/deactivate a user;
- trigger a password reset or temporary-password workflow.

No hard deletion.

### 17.6 Routes

An admin can:

- create a route;
- edit route name/code;
- activate/deactivate a route.

A route cannot be deactivated when doing so would create invalid active-driver state without explicit handling.

---

## 18. PDF

PDF generation is optional and initiated by an admin.

V1 behavior:

- available for closed returns;
- generated on demand;
- not required during close;
- not permanently stored unless later proven necessary;
- printable on standard paper;
- generated by the backend from trusted database data;
- includes signatures;
- excludes photos.

PDF content:

- ReturnFlow and tenant branding;
- return number;
- status;
- customer;
- product;
- quantity and unit;
- reason and optional reason details;
- driver observation;
- driver name and route;
- customer representative name and signature;
- warehouse Yes/No decisions;
- warehouse observation;
- warehouse representative name and signature;
- creation and close timestamps;
- responsible admin.

Do not adopt a PDF library with licensing incompatible with commercial SaaS use.

---

## 19. Notifications

Browser push notifications and mobile push notifications are outside V1.

The web application may:

- refresh summary counts and lists on a small polling interval;
- highlight newly received returns while the dashboard is open;
- show an in-app toast when new data is detected.

Do not add service workers, push subscriptions, or a real-time messaging stack in the initial implementation.

---

## 20. Search and operational reporting

V1 reporting is operational, not financial.

Required:

- summary counts;
- searchable return list;
- status/reason/date/driver/route filters;
- latest returns.

Not required:

- charts;
- trend analytics;
- financial totals;
- driver performance scoring;
- exports beyond the individual PDF;
- complex BI dashboards.

---

## 21. Multi-tenant architecture

V1 uses one PostgreSQL database and one shared schema.

Every tenant-owned record must contain `tenant_id`.

### 21.1 Tenant context

For authenticated business requests, the tenant is derived from trusted authentication data associated with the user/session.

During the tenant-foundation phase only, a temporary default resolver may resolve the bootstrapped `Warehouse` tenant. Once authentication exists, protected requests must derive the tenant from the authenticated principal rather than from client input.

The client must never choose or submit a tenant ID for normal business requests.

Rules:

- never trust a tenant ID from request JSON or query parameters;
- every repository query involving tenant-owned data must include tenant scope;
- cross-tenant records should behave as not found;
- object storage paths must be tenant-scoped;
- cache keys, if introduced later, must be tenant-scoped;
- unique constraints must consider tenant boundaries where appropriate;
- integration tests must prove tenant isolation.

Do not use a separate database per tenant in V1.

### 21.2 Initial tenant model

Recommended fields:

- `id` UUID;
- `name`;
- `slug`;
- `status`;
- `createdAt`;
- `updatedAt`.

Tenant branding and advanced configuration are future capabilities.

---

## 22. Recommended domain model

### 22.1 Tenant

Owns users, routes, reasons, and returns.

### 22.2 User

Recommended fields:

- `id`;
- `tenantId`;
- `routeId` nullable for admins;
- `role` (`DRIVER`, `ADMIN`);
- `fullName`;
- globally unique normalized email in V1;
- password hash;
- active flag;
- password-change/reset metadata;
- timestamps.

### 22.3 Route

Recommended fields:

- `id`;
- `tenantId`;
- `code`;
- `name`;
- active flag;
- timestamps.

### 22.4 ReturnReason

Recommended fields:

- `id`;
- `tenantId`;
- `code`;
- `label`;
- `active`;
- `sortOrder`;
- `requiresDetails`;
- timestamps.

### 22.5 ProductReturn

Use a clear code name such as `ProductReturn` or `ReturnRecord` rather than creating confusing generic abstractions.

Recommended fields:

- UUID ID;
- tenant ID;
- return number;
- driver ID;
- route ID;
- route code/name snapshot;
- customer name;
- product name;
- quantity;
- unit;
- reason ID;
- reason details;
- driver observation;
- status;
- customer representative name;
- customer signature object key;
- review owner and timestamp;
- sellable;
- credit customer;
- charge customer;
- charge driver;
- warehouse observation;
- warehouse representative name;
- warehouse signature object key;
- closed by and closed at;
- cancelled by, cancelled at, cancellation reason;
- created and updated timestamps;
- optimistic-lock version.

### 22.6 ReturnPhoto

Recommended fields:

- ID;
- tenant ID;
- return ID;
- object key;
- content type;
- size;
- sort order;
- created timestamp.

### 22.7 ReturnEvent

A minimal event/audit model may store major lifecycle events only:

- `CREATED`;
- `CLOSED`;
- `CANCELLED`.

Do not implement a generic event-sourcing system.

Review ownership and timestamps may remain fields on the return.

---

## 23. API architecture

The backend is a **modular monolith**.

Use Java and Spring Boot.

Recommended feature modules:

```text
auth
tenant
user
route
returnreason
returnrecord
storage
pdf
common
```

Prefer feature-based packages over one global controller/service/repository package.

Do not create microservices.

### 23.1 API conventions

- base path: `/api/v1`;
- JSON for normal requests/responses;
- multipart only for file operations where appropriate;
- UUID internal IDs;
- ISO-8601 date/time;
- server-side pagination;
- Bean Validation;
- consistent RFC 7807 `ProblemDetail` errors;
- OpenAPI documentation;
- no entity objects returned directly from controllers;
- explicit request/response DTOs;
- no generic CRUD controller framework;
- no client-provided audit fields;
- no client-provided tenant ID.

### 23.2 Suggested endpoint groups

Authentication:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Driver returns:

```text
GET    /api/v1/driver/returns
POST   /api/v1/driver/returns
GET    /api/v1/driver/returns/{id}
PUT    /api/v1/driver/returns/{id}
POST   /api/v1/driver/returns/{id}/photos
DELETE /api/v1/driver/returns/{id}/photos/{photoId}
PUT    /api/v1/driver/returns/{id}/customer-signature
```

Admin returns:

```text
GET  /api/v1/admin/returns
GET  /api/v1/admin/returns/{id}
POST /api/v1/admin/returns/{id}/start-review
POST /api/v1/admin/returns/{id}/release-review
POST /api/v1/admin/returns/{id}/take-over-review
PUT  /api/v1/admin/returns/{id}/review
POST /api/v1/admin/returns/{id}/close
POST /api/v1/admin/returns/{id}/cancel
GET  /api/v1/admin/returns/{id}/pdf
GET  /api/v1/admin/dashboard/summary
```

Configuration and users:

```text
GET  /api/v1/reasons
GET  /api/v1/admin/users
POST /api/v1/admin/users
PUT  /api/v1/admin/users/{id}
POST /api/v1/admin/users/{id}/activate
POST /api/v1/admin/users/{id}/deactivate

GET  /api/v1/admin/routes
POST /api/v1/admin/routes
PUT  /api/v1/admin/routes/{id}
POST /api/v1/admin/routes/{id}/activate
POST /api/v1/admin/routes/{id}/deactivate
```

Endpoint design may be refined, but the domain behavior must remain explicit.

---

## 24. Authentication and security

V1 uses email and password.

The normalized email address is globally unique in V1 so login requires only email and password. A future tenant-specific login strategy may revisit this decision intentionally, but no client-provided tenant identifier is accepted in V1 authentication requests.

Recommended architecture:

- Spring Security;
- password hashing with a modern adaptive password hash;
- short-lived access token;
- refresh-token rotation;
- explicit logout/revocation behavior;
- role and tenant claims derived from trusted server data;
- rate limiting or basic protection on authentication endpoints;
- secure secrets through environment variables.

Storage guidance:

- web: access token in memory and refresh mechanism using a secure HttpOnly cookie where practical;
- mobile: sensitive tokens stored in Expo SecureStore;
- never store plaintext passwords;
- never log tokens or passwords.

Authorization must be enforced in the API even when the UI hides an action.

---

## 25. Concurrency and review ownership

Use optimistic locking on `ProductReturn`.

The review start operation must:

- verify status is `WAITING_WAREHOUSE`;
- set status to `IN_REVIEW`;
- set review owner and timestamp;
- commit atomically.

Driver updates must:

- verify ownership;
- verify tenant;
- verify status is `WAITING_WAREHOUSE`;
- verify record version;
- fail clearly on stale updates.

Warehouse updates must:

- verify tenant;
- verify admin role;
- verify status is `IN_REVIEW`;
- verify current review ownership or explicit takeover;
- verify record version.

Use HTTP conflict responses for concurrent state conflicts.

---

## 26. Database

Production: PostgreSQL.
Local development: PostgreSQL through Docker Compose.

Requirements:

- Flyway migrations;
- no automatic schema mutation in production;
- UUID primary keys;
- sensible foreign keys and indexes;
- check constraints where useful;
- tenant-aware unique constraints;
- indexes for common filters and search;
- timestamps stored consistently;
- backups configured before operational production use.

Likely indexes include:

- `(tenant_id, status, created_at)`;
- `(tenant_id, driver_id, created_at)`;
- `(tenant_id, route_id, created_at)`;
- `(tenant_id, reason_id, created_at)`;
- `(tenant_id, return_number)`;
- normalized/search-friendly customer and product fields as required.

Avoid premature full-text-search infrastructure. PostgreSQL search capabilities or case-insensitive matching are enough for V1.

---

## 27. Monorepo

The project is one product, one Git repository, and three deployable applications.

```text
returnflow/
├── CLAUDE.md
├── README.md
├── BOOTSTRAP_PROMPT.md
├── apps/
│   ├── api/
│   │   └── CLAUDE.md
│   ├── web/
│   │   └── CLAUDE.md
│   └── mobile/
│       └── CLAUDE.md
├── docs/
│   ├── DIAGRAMS.md
│   └── IMPLEMENTATION_PLAN.md
├── infra/
├── scripts/
├── .github/workflows/
└── .vscode/
```

The actual Java, React, and React Native code all live inside this repository.

The applications remain independent:

- separate dependencies;
- separate build commands;
- separate tests;
- separate deploys;
- separate environment variables.

The monorepo does not require one language or one combined build.

### 27.1 Tooling restraint

Do not introduce Nx, Turborepo, Bazel, or a Maven multi-module build at the root in V1.

Use:

- Maven Wrapper inside `apps/api`;
- npm inside `apps/web`;
- npm/Expo inside `apps/mobile`;
- Docker Compose inside `infra`;
- VS Code tasks for convenience;
- path-filtered CI workflows.

---

## 28. Local development

Expected services:

```text
API       http://localhost:8080
Web       http://localhost:5173
Postgres  localhost:5433 (host port; container's internal Postgres port is still 5432 — 5433 avoids clashing with a native local Postgres install)
MinIO     local S3-compatible endpoints
Mobile    Expo development server
```

Typical commands:

```powershell
# Infrastructure
docker compose -f infra/docker-compose.yml up -d

# API
cd apps/api
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local

# Web
cd apps/web
npm install
npm run dev

# Mobile
cd apps/mobile
npm install
npx expo start
```

The repository should eventually include VS Code tasks such as:

- ReturnFlow: Start Infrastructure
- ReturnFlow: Run API
- ReturnFlow: Run Web
- ReturnFlow: Run Mobile
- ReturnFlow: Run API Tests
- ReturnFlow: Run Web Tests
- ReturnFlow: Run Mobile Tests

IntelliJ may open `apps/api` independently, but it is never required for build or deployment.

---

## 29. Deployment target

Initial target architecture:

- Web: Cloudflare Pages
- API: Railway or another managed container/application service selected after current pricing and reliability are revalidated
- PostgreSQL: Neon or another managed PostgreSQL provider selected after revalidation
- Object storage: Cloudflare R2
- Mobile development: Expo
- CI/CD: GitHub Actions and provider Git integration

A VPS is not required for the MVP.

Do not hard-code provider-specific logic into the domain.

Provider selections and free-tier assumptions must be revalidated immediately before deployment because pricing and limits can change.

---

## 30. CI/CD

Use independent workflows with path filters.

Examples:

- changes under `apps/api/**` run API build and tests;
- changes under `apps/web/**` run web lint, test, and build;
- changes under `apps/mobile/**` run mobile typecheck, lint, and tests;
- changes under shared documentation do not deploy applications unless required.

No deployment should require opening an IDE.

A push to the appropriate branch triggers CI.

Production deployment should occur only after tests pass.

---

## 31. Testing strategy

Testing must focus on business risk.

### 31.1 API

Required high-value tests:

- authentication;
- tenant isolation;
- driver cannot access another driver's return;
- admin cannot access another tenant;
- driver can edit only `WAITING_WAREHOUSE`;
- start review transition;
- concurrent start-review conflict;
- only reviewer can update review;
- close validation;
- cancel validation;
- `OTHER` requires details;
- max five photos;
- PDF available only when allowed;
- return number uniqueness.

Use unit tests for state rules and integration tests for persistence/security.

Testcontainers may be used for meaningful PostgreSQL integration tests if it does not slow early development excessively.

### 31.2 Web

Prioritize:

- login behavior;
- returns list filters;
- explicit start review;
- required warehouse fields;
- signature validation;
- read-only state for non-owner admins;
- close/cancel flows.

### 31.3 Mobile

Prioritize:

- required fields;
- reason `OTHER`;
- EA/CTN selection;
- photo limit;
- signature required;
- editing disabled after review starts;
- network failure handling.

Full end-to-end automation can wait until the core pilot flow is stable.

---

## 32. Logging and observability

Use structured application logs.

Log:

- request correlation ID;
- authenticated user ID when safe;
- tenant ID when safe;
- return ID and lifecycle actions;
- error category;
- external storage/PDF failures.

Do not log:

- passwords;
- tokens;
- signature image contents;
- full photo contents;
- sensitive request payloads unnecessarily.

V1 does not require a large observability platform.

Basic health endpoints and provider logs are enough initially.

---

## 33. Coding principles

- Java 21 or the agreed supported LTS;
- Spring Boot compatible stable release selected at scaffold time;
- TypeScript strict mode;
- Clean Code;
- SOLID only where it improves clarity;
- feature-based modules;
- explicit domain names;
- small functions and components;
- no hidden side effects;
- no generic base service/controller/repository hierarchy;
- no speculative abstraction;
- no duplicated business status rules across clients;
- backend remains authoritative;
- validate input on client and server;
- use formatting/linting tools;
- keep commits small and focused;
- update documentation whenever behavior changes.

---

## 34. API-to-client contracts

Spring Boot should expose OpenAPI documentation.

Web and mobile may generate or consume typed TypeScript API clients from OpenAPI.

This is preferred over manually duplicating Java DTOs as TypeScript interfaces.

Do not force contract generation into Phase 0 if it prevents the basic scaffold from working. Introduce it when the first stable API slice exists.

---

## 35. What is explicitly outside V1

Do not implement:

- multiple products inside one return;
- ERP integration;
- product catalog;
- barcode scanning;
- invoice integration;
- price or financial calculations;
- accounting workflows;
- public company signup;
- subscription billing;
- white-label apps;
- custom apps per tenant;
- social login;
- magic links;
- mobile or browser push notifications;
- offline mode;
- real-time WebSocket infrastructure;
- complex analytics;
- charts;
- financial reports;
- bulk exports;
- permanent deletion;
- complex role hierarchy;
- microservices;
- Kafka/RabbitMQ;
- Kubernetes;
- separate database per tenant;
- automated OCR;
- AI features;
- a generic incident-management platform.

Future evolution from Return to a broader Incident domain may be documented, but V1 code must remain focused on product returns.

---

## 36. Future roadmap candidates

Only after V1 validation:

- self-service tenant onboarding;
- subscription billing;
- configurable branding;
- reason management;
- additional units;
- ERP/product catalog integration;
- barcode scanning;
- browser/mobile push;
- offline mobile queue;
- advanced dashboards;
- exports;
- richer audit trail;
- configurable workflows;
- broader incident types;
- multi-route drivers;
- financial integrations.

These are candidates, not commitments.

---

## 37. Definition of done for a feature

A feature is complete only when:

- behavior matches this source of truth;
- tenant and role authorization are enforced in the API;
- validation exists on client and server;
- relevant tests pass;
- errors are understandable;
- loading, empty, and failure states are handled;
- no secret is committed;
- documentation is updated if behavior changed;
- CI passes;
- the change is small enough to review;
- no unrelated future feature was added.

---

## 38. Development instructions

When working on ReturnFlow:

1. Read this root `CLAUDE.md`.
2. Read the nearest application-specific `CLAUDE.md` for every application that may change.
3. Read `docs/IMPLEMENTATION_PLAN.md` for roadmap scope and acceptance criteria.
4. Read the root `progress.md` for the current phase, current task, approved work, known issues, and relevant implementation decisions.
5. Inspect the repository, `git status`, and the current diff before generating or changing files.
6. Make the smallest coherent change that satisfies only the requested phase or subphase.
7. Do not implement future phases early.
8. Do not silently change product, architecture, security, or workflow decisions.
9. Surface material ambiguity before inventing a new rule.
10. Prefer a working simple implementation over an impressive architecture.
11. Run the relevant tests, builds, migrations, and smoke checks defined by the current phase.
12. Report changed files, commands executed, validation results, and important trade-offs.
13. During implementation, stop for developer review before creating a Git commit.
14. Preserve the monorepo and independent deploy model.
15. Do not reformat unrelated files, rewrite entire documents unnecessarily, or introduce line-ending-only changes.

---

## 39. Development workflow

This workflow is mandatory for every future implementation, regardless of the AI model, IDE, or coding assistant.

The workflow has two separate prompts or tasks for each phase:

1. **Implementation task** — implement and validate, then stop for review without committing.
2. **Finalization task** — only after explicit developer approval, update progress, commit, report the result, and stop.

### 39.1 Document responsibilities

Each project document has one responsibility.

#### `CLAUDE.md`

Defines:

- product decisions;
- business rules;
- architecture;
- security boundaries;
- engineering principles;
- development workflow.

It must not be used to record:

- current phase status;
- implementation history;
- approvals;
- commit messages;
- commit hashes.

#### `docs/IMPLEMENTATION_PLAN.md`

Defines:

- roadmap order;
- phase and subphase boundaries;
- goals;
- deliverables;
- exclusions;
- acceptance criteria;
- UX checkpoints.

It must not be used to record:

- current project status;
- completed work;
- approvals;
- implementation history;
- planned or actual commit messages;
- commit hashes.

#### `progress.md`

Defines the current implementation state.

It should contain only:

- current phase;
- current task;
- review status;
- concise completed-phase summaries;
- pending phases;
- current capabilities;
- relevant architectural decisions discovered during implementation;
- unresolved known issues;
- concise latest validation results when they remain useful.

It must not duplicate Git history or become a permanent command-by-command execution log.

Do not store commit hashes, commit-message catalogs, full terminal transcripts, resolved transient errors, or obsolete review details in `progress.md`.

#### Git

Git is the source of truth for:

- commit history;
- commit hashes;
- authorship;
- timestamps;
- diffs;
- previous document versions.

A commit hash may be reported in the coding assistant's final response, but it must not be written back into `progress.md`, `CLAUDE.md`, or `docs/IMPLEMENTATION_PLAN.md`.

### 39.2 Source-of-truth resolution

Use each document for its own domain:

1. Product, business, architecture, and security decisions: `CLAUDE.md`.
2. Roadmap order, phase scope, exclusions, and acceptance criteria: `docs/IMPLEMENTATION_PLAN.md`.
3. Current implementation state and unresolved implementation facts: `progress.md`.
4. Historical code and documentation changes: Git.

An explicit task may narrow the current phase, but it must not silently broaden the phase or contradict `CLAUDE.md`.

When documents conflict:

- do not guess;
- identify the exact conflict;
- stop before implementing the conflicting part;
- ask the developer to choose or approve the correction.

### 39.3 Session startup

Before any implementation or finalization task:

1. Read `CLAUDE.md`.
2. Read the relevant application-specific `CLAUDE.md` files.
3. Read `docs/IMPLEMENTATION_PLAN.md`.
4. Read `progress.md`.
5. Run `git status`.
6. Inspect existing uncommitted changes before modifying anything.
7. Confirm the current phase and whether the task is implementation, review correction, or finalization.
8. Never skip unfinished or unreviewed work.

If `progress.md` does not exist, create a concise initial version before implementing product features.

### 39.4 Implementation task

During an implementation task:

1. Implement only one approved phase or subphase.
2. Keep the repository buildable and testable.
3. Update `progress.md` with a concise implementation summary, relevant decisions, known issues, and validation results.
4. Mark the phase as **Pending Review**.
5. Do not mark the phase as approved.
6. Do not create a Git commit.
7. Do not start the next phase.
8. Do not modify `CLAUDE.md` or `docs/IMPLEMENTATION_PLAN.md` merely to record progress.
9. Modify product or roadmap documentation only when the task explicitly requests a real product, architecture, workflow, or roadmap correction.
10. Stop and wait for developer review.

### 39.5 Developer review

Only the developer may approve a phase.

A coding assistant may:

- summarize the implementation;
- identify risks;
- propose corrections;
- run additional validation;
- apply requested review fixes.

A coding assistant must not infer approval from successful tests or from its own assessment.

### 39.6 Finalization task

A finalization task may begin only after explicit developer approval.

During finalization:

1. Re-read the current diff and `progress.md`.
2. Update `progress.md` once, before the commit:
   - mark the reviewed phase as approved;
   - move it to the completed-phase summary;
   - set the next phase as current but not started, when applicable;
   - remove obsolete pending-review wording;
   - preserve relevant architectural decisions and unresolved issues;
   - keep the document concise.
3. Do not add a commit hash or planned commit message to any Markdown document.
4. Do not modify `CLAUDE.md` or `docs/IMPLEMENTATION_PLAN.md` unless the finalization task explicitly requests a real correction to those documents.
5. Run the relevant validation required to ensure the approved working tree is still valid.
6. Inspect `git diff --name-only` and confirm that every changed file belongs to the approved phase.
7. If unexpected files or unrelated changes exist, stop and report them instead of committing.
8. Create one focused Git commit for the approved phase or subphase.
9. Report the resulting commit hash in the final response only.
10. Run `git status` and report whether the working tree is clean.
11. Do not begin the next phase.

There is no second documentation commit to record the first commit's hash.

### 39.7 Commit strategy

The default is one focused commit per approved phase or explicitly defined subphase.

Rules:

- never combine unrelated phases into one commit;
- never create an additional commit only to store another commit's hash;
- never maintain a catalog of commit messages inside the implementation plan;
- do not amend or rewrite approved history unless the developer explicitly requests it;
- report the commit message and hash in the coding assistant response, while Git remains the permanent record.

### 39.8 Progress maintenance

`progress.md` represents the current project state, not a permanent execution diary.

When maintaining it:

- replace outdated current-task and current-validation details;
- summarize approved phases instead of retaining full implementation transcripts;
- preserve only decisions that affect future work;
- keep unresolved issues until they are resolved;
- remove resolved transient errors when they no longer provide useful context;
- rely on Git for previous versions and historical detail;
- keep the file concise enough to read at the start of every development session.

### 39.9 Documentation-change boundaries

Documentation is part of the source code, but each document must change only for a relevant reason.

Update:

- `CLAUDE.md` when a product, business, architecture, security, or workflow decision changes;
- `docs/IMPLEMENTATION_PLAN.md` when roadmap structure, phase scope, exclusions, or acceptance criteria change;
- `progress.md` when implementation state, review status, relevant implementation decisions, validation, or known issues change;
- `README.md` when setup, local execution, or contributor-facing usage changes.

Do not edit root documentation as a side effect of phase finalization.

---

## 40. Current decision status

The following are considered decided for V1:

- ReturnFlow name;
- monorepo;
- Spring Boot API;
- React web;
- React Native + Expo mobile;
- PostgreSQL;
- Cloudflare R2-compatible storage abstraction;
- multi-tenant shared schema;
- initial tenant named `Warehouse`;
- roles `DRIVER` and `ADMIN`;
- globally unique normalized email for V1 login;
- one product per return;
- one route per driver;
- reasons listed in this file;
- units `EA` and `CTN`;
- maximum five photos;
- customer and warehouse drawn signatures;
- lifecycle `WAITING_WAREHOUSE` → `IN_REVIEW` → `CLOSED`, with admin cancellation;
- driver editing only while waiting;
- warehouse fields faithful to useful paper fields;
- PDF generated on demand for closed returns;
- no browser/mobile push in V1;
- operational summary without charts;
- no VPS required for MVP development;
- separate builds and deploys from one repository.

Any change to these decisions must be intentional and documented in the correct source-of-truth file before dependent implementation begins.
