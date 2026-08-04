# ReturnFlow API — Claude Instructions

> Applies to `apps/api`. Read the root `CLAUDE.md` first.

## Purpose and stack

This application is the authoritative backend for ReturnFlow.

Use:

- Java 21 LTS or the agreed supported LTS;
- a stable Spring Boot release compatible with that Java version;
- Maven Wrapper;
- Spring Web;
- Spring Security;
- Spring Data JPA;
- PostgreSQL;
- Flyway;
- Bean Validation;
- OpenAPI;
- an object-storage abstraction compatible with Cloudflare R2 and local MinIO.

The API is a modular monolith. Do not turn it into microservices.

## Package structure

Use feature-based packages under a stable base package such as:

```text
com.returnflow
├── auth
├── tenant
├── user
├── route
├── returnreason
├── returnrecord
├── storage
├── pdf
└── common
```

Each feature may contain its own controller, DTOs, services/domain logic, repository, mapping, and tests.

Do not create global folders that collect every controller, service, or repository. Avoid heavy architecture ceremony for simple CRUD. Keep state-transition rules explicit and tested.

## Domain naming

Prefer `ProductReturn` or `ReturnRecord` for the main entity. API resources remain `/returns`.

Do not generalize the V1 domain to `Incident`.

## Module responsibilities

### auth

- login, refresh, logout, current user;
- password hashing;
- token/session lifecycle;
- tenant and role context;
- basic protection of authentication endpoints.

### tenant

- tenant entity;
- bootstrap support;
- tenant status;
- current tenant context.

### user

- driver/admin users;
- activation/deactivation;
- route assignment;
- password reset or temporary-password flow;
- no hard deletion.

### route

- tenant-scoped route CRUD;
- active state;
- driver association;
- route snapshots in returns.

### returnreason

- tenant-scoped reasons;
- Air House seed data;
- active ordered list;
- `OTHER` requires details;
- no reason-management UI in V1.

### returnrecord

- create/update driver return;
- driver ownership;
- status transitions;
- admin review;
- close/cancel;
- search and pagination;
- dashboard summary;
- optimistic locking;
- human-readable return number.

### storage

- upload/delete/read metadata;
- Cloudflare R2 production adapter;
- filesystem-backed local/MVP adapter (Phase 5A) behind the same `ReturnMediaStorage` interface — MinIO and the eventual R2 adapter remain valid future implementations of that interface;
- generated object keys;
- tenant isolation;
- file validation.

### pdf

- closed-return PDF;
- signatures included;
- photos excluded;
- generated on demand;
- library compatible with commercial SaaS use.

## Security rules

Every operation must verify:

- authenticated user;
- active user status;
- tenant;
- role;
- resource ownership;
- allowed lifecycle status;
- optimistic-lock version where relevant.

Never trust tenant ID, role, driver ID, route, audit fields, or final storage keys from the client.

Driver and route derive from the authenticated user.

Cross-tenant access must not reveal the existence of another tenant's records. Integration tests must prove tenant isolation.

## Persistence rules

- PostgreSQL in meaningful environments;
- Flyway for schema changes;
- safe schema validation outside tests;
- UUID primary keys;
- `tenant_id` on every tenant-owned table;
- `@Version` on returns;
- explicit indexes and constraints;
- active flags for users, routes, and reasons;
- lifecycle status instead of deleting returns;
- do not use H2 as the only integration-test database.

## Return state rules

### Driver create

Creates a return in `WAITING_WAREHOUSE` and assigns tenant, driver, route, route snapshot, return number, and timestamps.

### Driver update

Allowed only when the authenticated driver owns the return, the tenant matches, the status is `WAITING_WAREHOUSE`, and the entity version is current.

### Start review

Allowed only for an admin when status is `WAITING_WAREHOUSE`. Atomically set status `IN_REVIEW`, review owner, and review start timestamp.

### Review update

Allowed only when status is `IN_REVIEW` and the authenticated admin owns the review or explicitly takes it over.

### Close

Allowed only from `IN_REVIEW` and requires:

- sellable;
- credit customer;
- charge customer;
- charge driver;
- warehouse representative name;
- warehouse signature.

Set status `CLOSED`, closed by, and closed at.

### Cancel

Admin only, from waiting or review, with a required cancellation reason. Set status `CANCELLED`, actor, and timestamp.

Closed and cancelled returns are immutable in V1.

## Validation

Server-side validation includes:

- customer name not blank;
- product name (`productName`) not blank, free text, max 200 characters, one product per return, immutable after creation, no product catalog;
- quantity is a positive integer;
- unit only `EA` or `CTN`;
- active reason belongs to the tenant;
- `OTHER` requires nonblank reason details;
- no more than five photos;
- customer representative name and signature required;
- warehouse closing fields required;
- image/signature type and size limits;
- route active at assignment time;
- normalized email and a documented uniqueness strategy.

Return consistent RFC 7807 `ProblemDetail` errors without leaking stack traces.

## Files and signatures

Store metadata in PostgreSQL and bytes in object storage.

Recommended key shapes:

```text
tenants/{tenantId}/returns/{returnId}/photos/{generatedId}.jpg
tenants/{tenantId}/returns/{returnId}/signatures/customer/{generatedId}.svg
tenants/{tenantId}/returns/{returnId}/signatures/warehouse/{generatedId}.svg
```

Never accept arbitrary final keys from clients. Validate actual content where practical. Photos and customer signature can change only while the return is waiting. Phase 5A ships upload/list/authenticated-content-retrieval only — no remove/replace endpoint yet, since driver editing does not exist yet either.

The customer signature (Phase 5B) never arrives as an image: the client sends only a signer name and normalized (0..1) stroke points as JSON, and the backend renders them into a sanitized, deterministic `image/svg+xml` document (no scripts, no external resources, no client-supplied markup) before storing it through `ReturnMediaStorage`. A return has at most zero or one signature — enforced by a unique constraint plus the same row-locking pattern `ReturnPhotoService` uses — and it is immutable once created, with the same upload/list-equivalent/authenticated-content-retrieval-only scope as photos (`POST`/`GET` metadata, `GET .../content`; no replace or delete endpoint).

## API conventions

- base path `/api/v1`;
- JSON for normal requests;
- multipart only where appropriate;
- UUID internal IDs;
- ISO-8601 date/time;
- server-side pagination;
- explicit request/response DTOs;
- no direct JPA-entity responses;
- no generic CRUD controller framework;
- no client-provided tenant or audit data.

Suggested endpoint groups are defined in the root `CLAUDE.md` and may be refined without changing behavior.

## Error categories

Use consistent errors for:

- validation;
- authentication;
- access denied;
- resource not found;
- invalid transition;
- review ownership conflict;
- optimistic-lock conflict;
- file limit/type problems;
- storage unavailable;
- PDF generation failure.

## OpenAPI

Expose accurate authentication, role, pagination, enum, validation, and error contracts. Do not expose internal entities.

Typed TypeScript client generation may begin after the first stable API slice, not necessarily during scaffolding.

## Testing priorities

High-value tests are mandatory for:

- tenant isolation;
- driver ownership;
- driver update lifecycle;
- `OTHER` details;
- review claim conflict;
- review-owner enforcement;
- close and cancel validation;
- terminal immutability;
- photo count;
- return-number concurrency;
- dashboard tenant scope;
- PDF authorization.

Prefer behavior tests over implementation-mirroring tests.

## Configuration

Use environment variables and profile-specific configuration for database, security secrets, storage, CORS, bootstrap admin/tenant, file limits, PDF branding, and application URLs.

Provide examples without secrets. Never commit production credentials.

## Do not

Do not add microservices, Kafka/RabbitMQ, event sourcing, generic CRUD abstractions, product catalogs, invoice calculations, client-supplied tenant data, image bytes in regular database columns, automatic state transitions on GET, mandatory PDF generation, caching without evidence, or background jobs without a real need.

## First API milestone

The first milestone only establishes a buildable project, health endpoint, database connectivity, Flyway baseline, package structure, tests, and a consistent error skeleton. It does not implement the complete business workflow.
