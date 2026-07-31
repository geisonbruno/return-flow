# ReturnFlow — Progress

## Current phase

**Phase 2C — Administration Foundation.** Not started.

Phase 0 (Monorepo scaffold), Phase 1 (Backend foundation), Phase 2A (Tenant Foundation), and Phase 2B (Authentication) are all **reviewed and approved** by the developer.

## Current task

None. Phase 2C has not started and will not start until a separate task requests it.

## Review status

- Phase 0 — Monorepo scaffold — **approved**.
- Phase 1 — Backend foundation — **approved**.
- Phase 2A — Tenant Foundation — **approved**.
- Phase 2B — Authentication — **approved**.

## Completed phases

- **Phase 0 — Monorepo scaffold** (approved 2026-07-26): buildable skeleton for `apps/api` (Spring Boot), `apps/web` (Vite + React + TypeScript), `apps/mobile` (Expo + TypeScript), `infra/docker-compose.yml`, and shared dev-experience tooling.
- **Phase 1 — Backend foundation** (approved 2026-07-26): PostgreSQL + Flyway migrations, Hibernate schema validation (no auto-mutation), UTC timestamps, RFC 7807 `ProblemDetail` error handling, OpenAPI, Actuator health/info, and a Testcontainers-based integration-test strategy.
- **Phase 2A — Tenant Foundation** (approved 2026-07-28): `Tenant` entity/migration/repository, an idempotent default-tenant ("Warehouse") bootstrap, and the `Auditable` base class (`createdAt`/`updatedAt`) all future entities extend.
- **Phase 2B — Authentication** (approved 2026-07-31): full email/password authentication — see Current capabilities and Architectural decisions below. Validation: `mvnw test` **62/62 pass**, `mvnw package` **BUILD SUCCESS**.

## Pending phases

- Phase 2C — Administration Foundation (routes, user/route CRUD)
- Phase 3A — Return domain model
- Phase 3B — Driver API
- Phase 4 — Mobile driver workflow
- Phase 5 — Photos and customer signature
- Phase 6 — Operational dashboard
- Phase 7 — Warehouse review
- Phase 8 — Administration UI
- Phase 9 — PDF
- Phase 10 — Deployment

## Current capabilities

- **`apps/api`**: Spring Boot 4.1.0 / Java 21. `mvnw test` (62/62, Testcontainers-backed) and `mvnw package` pass. PostgreSQL + Flyway + Hibernate-validate + `ProblemDetail` error handling + OpenAPI + Actuator. Tenant-owned `app_user` table (`DRIVER`/`ADMIN`, BCrypt-hashed passwords, globally-unique normalized email) with an idempotent, fail-fast first-admin bootstrap from `BOOTSTRAP_ADMIN_*`. Rotating refresh tokens stored only as SHA-256 hashes; short-lived HS256 JWT access tokens. `POST /api/v1/auth/{login,refresh,logout}` and `GET /api/v1/auth/me`. Every protected request derives `TenantContext` from the authenticated principal. No user CRUD, routes, or returns yet, by design.
- **`apps/web`**: Vite + React 19 + TypeScript (strict). `lint`, `typecheck`, `build`, `test` all pass.
- **`apps/mobile`**: Expo SDK 57 + TypeScript (strict). `typecheck` and `test` pass. `lint`/`expo start` blocked by a local Node version gate — see Known issues.
- **`infra/docker-compose.yml`**: Postgres 16 (default host port `5433`, overridable via `POSTGRES_PORT` — a native Windows Postgres install on the dev machine already occupies `5432`) + MinIO, both verified healthy.
- Dev experience: root `.editorconfig`, `.gitignore`, `.vscode/tasks.json`, path-filtered GitHub Actions, `.env.example` files, root/app READMEs.

## Architectural decisions

**Stack and tooling:**

- Spring Boot 4.1.0 + Java 21; `springdoc-openapi` pinned to `3.0.3` (first version compatible with Boot 4.x/OpenAPI 3.1, not managed by Boot's own BOM).
- `apps/web` pins `vite@6.4.3`/`@vitejs/plugin-react@4.3.4`/`oxlint@1.16.0`/`jsdom@25.0.1` because newer releases require Node `>=20.19`, above this machine's Node `20.18.0`; bump once the local/CI Node baseline moves.
- `apps/mobile` uses Expo's `blank-typescript` template (no navigation library pulled in until one is needed).
- MinIO pinned to `RELEASE.2025-09-07T16-13-09Z`, Postgres to `16-alpine`, for reproducibility.
- No datasource is configured in base `application.properties` — an explicit `local` or `prod` profile is always required, so the app never silently connects to an undefined database.
- Testcontainers (not a static test datasource) backs every integration test that needs a real database, so `mvnw test` is self-contained and identical in local dev and CI.

**Multi-tenancy and authentication:**

- `TenantContext` (a static `ThreadLocal`, modeled on `SecurityContextHolder`) is populated exclusively from the authenticated principal, by `auth.security.JwtAuthenticationFilter` inside the Spring Security filter chain. `TenantResolver.resolve(UUID)` looks the tenant up by ID and requires `ACTIVE` status; `DefaultTenantResolver` is the only implementation.
- Refresh tokens are 256-bit `SecureRandom` opaque values, persisted only as SHA-256 hashes (not BCrypt — the raw value is already high-entropy, and a deterministic digest is what makes O(1) hash lookup possible for rotation/revocation). User passwords use BCrypt via Spring Security's `BCryptPasswordEncoder`.
- Login always performs the password comparison — against a pre-initialized dummy BCrypt hash when the email doesn't resolve to a user — before evaluating existence, active status, or password match, so no failure path is faster than another (prevents email enumeration via response timing).
- `AccessTokenService.validate()` explicitly null-checks the mandatory claims (`sub`, `tenantId`, `role`) before parsing them, so a validly-signed token missing a claim fails validation cleanly instead of throwing.
- Login, refresh, and `/me` each raise one exception type covering every failure cause for that endpoint, so responses never reveal which specific condition failed.
- JWT library is `io.jsonwebtoken:jjwt` (HS256) — small and sufficient for a self-issued, single-service token; no OAuth2/external identity provider is planned.
- No protected endpoint re-checks user active-status on every request except `/auth/me` (its explicit requirement) — re-checking everywhere would defeat the purpose of a short-lived (15-minute) stateless access token.
- `UserDetailsServiceAutoConfiguration` is excluded — this API never uses Spring Security's `UserDetailsService`/`AuthenticationManager` model, only bearer-token auth via `JwtAuthenticationFilter`.
- `ApplicationRunner` bootstraps (`TenantBootstrap`, `UserBootstrap`) are ordered explicitly (`@Order(1)`/`@Order(2)`, tenant before admin) and both use the same check-then-create idempotency pattern, backed by a database unique constraint as the actual correctness guarantee.

**Framework specifics for this exact stack (Spring Boot 4.1 / Spring Security 7.1)** — worth knowing before touching security or JSON code again:

- Security auto-configuration lives under `org.springframework.boot.security.autoconfigure.*` (not the Boot-3-era `org.springframework.boot.autoconfigure.security.servlet.*`).
- The auto-configured `ObjectMapper` bean is **Jackson 3** (`tools.jackson.databind.ObjectMapper`), not classic Jackson 2 (`com.fasterxml.jackson.databind.ObjectMapper`, which is only incidentally on the classpath via `springdoc`/`jjwt-jackson`). Anything needing an injected `ObjectMapper` must import the `tools.jackson` package.

## Known issues

- Expo SDK 57's CLI (`expo lint`, `expo start`) requires Node `>=20.19.4`; local dev machine runs Node `20.18.0`. Plain `tsc`/`jest` are unaffected. CI (`mobile.yml`) runs Node 22 and is unaffected. Needs a local Node upgrade, not a code change.
- `apps/web`'s pinned toolchain versions (see Architectural decisions) exist for the same underlying Node-version gap; revisit once the local/CI Node baseline moves to `>=20.19`.
- `npm audit` on `apps/mobile` reports moderate/high advisories (`uuid`, `brace-expansion`) — transitive dependencies of Expo's/Jest's own tooling, not fixable without forcing breaking downgrades.
