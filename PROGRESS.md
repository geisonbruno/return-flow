# ReturnFlow — Progress

## Current phase

**Phase 3B — Driver API.** Not started.

Phase 0 (Monorepo scaffold), Phase 1 (Backend foundation), Phase 2A (Tenant Foundation), Phase 2B (Authentication), Phase 2C (Administration Foundation), and Phase 3A (Return Domain Model) are all **reviewed and approved** by the developer.

## Current task

None. Phase 3B has not started and will not start until a separate task requests it.

## Review status

- Phase 0 — Monorepo scaffold — **approved**.
- Phase 1 — Backend foundation — **approved**.
- Phase 2A — Tenant Foundation — **approved**.
- Phase 2B — Authentication — **approved**.
- Phase 2C — Administration Foundation — **approved**.
- Phase 3A — Return Domain Model — **approved**.

## Completed phases

- **Phase 0 — Monorepo scaffold** (approved 2026-07-26): buildable skeleton for `apps/api` (Spring Boot), `apps/web` (Vite + React + TypeScript), `apps/mobile` (Expo + TypeScript), `infra/docker-compose.yml`, and shared dev-experience tooling.
- **Phase 1 — Backend foundation** (approved 2026-07-26): PostgreSQL + Flyway migrations, Hibernate schema validation (no auto-mutation), UTC timestamps, RFC 7807 `ProblemDetail` error handling, OpenAPI, Actuator health/info, and a Testcontainers-based integration-test strategy.
- **Phase 2A — Tenant Foundation** (approved 2026-07-28): `Tenant` entity/migration/repository, an idempotent default-tenant ("Warehouse") bootstrap, and the `Auditable` base class (`createdAt`/`updatedAt`) all future entities extend.
- **Phase 2B — Authentication** (approved 2026-07-31): full email/password authentication — see Current capabilities and Architectural decisions below. Validation: `mvnw test` **62/62 pass**, `mvnw package` **BUILD SUCCESS**.
- **Phase 2C — Administration Foundation** (approved 2026-07-31): tenant-owned route administration and full user administration — see Current capabilities and Architectural decisions below. Validation: `mvnw test` **98/98 pass**, `mvnw package` **BUILD SUCCESS**.
- **Phase 3A — Return Domain Model** (approved 2026-08-01): tenant-owned `return_record` domain and persistence foundation — see Current capabilities and Architectural decisions below. Validation: `mvnw test` **120/120 pass**, `mvnw package` **BUILD SUCCESS**.

## Pending phases

- Phase 3B — Driver API
- Phase 4 — Mobile driver workflow
- Phase 5 — Photos and customer signature
- Phase 6 — Operational dashboard
- Phase 7 — Warehouse review
- Phase 8 — Administration UI
- Phase 9 — PDF
- Phase 10 — Deployment

## Current capabilities

- **`apps/api`**: Spring Boot 4.1.0 / Java 21. `mvnw test` (120/120, Testcontainers-backed) and `mvnw package` pass. PostgreSQL + Flyway + Hibernate-validate + `ProblemDetail` error handling + OpenAPI + Actuator. Tenant-owned `app_user` table (`DRIVER`/`ADMIN`, BCrypt-hashed passwords, globally-unique normalized email) with an idempotent, fail-fast first-admin bootstrap from `BOOTSTRAP_ADMIN_*`. Rotating refresh tokens stored only as SHA-256 hashes; short-lived HS256 JWT access tokens. `POST /api/v1/auth/{login,refresh,logout}` and `GET /api/v1/auth/me`. Every protected request derives `TenantContext` from the authenticated principal. Tenant-owned, tenant-unique-coded `route` table. ADMIN-only `/api/v1/admin/routes` (create/list/get/update, no delete) and `/api/v1/admin/users` (create/list/get/update/reset-password, no delete), enforcing one active route per active DRIVER, no route for ADMIN, and self-protection against an admin deactivating or demoting themselves. Tenant-owned `return_record` domain and persistence foundation (`returnrecord.ReturnRecord`/`ReturnRecordCreator`/`ReturnRecordRepository`, a database-sequence-backed `RF-000001`-style return-number generator) enforcing the active-DRIVER-with-active-route creation rules and snapshotting the route used at creation time — domain/persistence only, no HTTP endpoint or client yet, by design.
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
- **`@ControllerAdvice`/`@RestControllerAdvice` beans need an explicit `@Order`, or a more specific handler can be silently shadowed by a less specific one.** Spring picks the first advice bean (by order, defaulting to `Ordered.LOWEST_PRECEDENCE` — i.e. unordered beans tie with each other, not with anything "later") that has *any* matching `@ExceptionHandler` for the thrown type; it does not compare specificity across beans. `GlobalExceptionHandler`'s blanket `Exception.class` fallback was accidentally "safe" only because `AuthExceptionHandler` happened to sort alphabetically before it — adding `route.RouteAdminExceptionHandler`/`user.UserAdminExceptionHandler` in this phase broke that luck immediately (every one of their intended 400/404/409 responses came back as 500, caught by a real failing `mvnw test` run). Fixed by giving every feature-specific advice `@Order(Ordered.HIGHEST_PRECEDENCE)` and `GlobalExceptionHandler` `@Order(Ordered.LOWEST_PRECEDENCE)` (documents intent; the real guarantee comes from the feature-specific side). Any future `@RestControllerAdvice` must follow the same pattern.

**Route and user administration (Phase 2C):**

- `route.Route` and its admin endpoints follow the same shape as `user`'s Phase 2B conventions: a normalization utility (`RouteCodeNormalizer` — trim + uppercase, mirroring `EmailNormalizer`), tenant-scoped repository lookups (`findByIdAndTenantId`) so a cross-tenant ID behaves as not found, and a dedicated `@RestControllerAdvice` per feature module.
- Route codes are unique per `(tenant_id, code)`, not globally — the same code is expected to recur across different tenants (e.g. every tenant might have a "1").
- `/api/v1/admin/**` authorization is a single `hasRole("ADMIN")` URL-pattern rule in `SecurityConfig`, not method-level annotations — `JwtAuthenticationFilter` already grants `ROLE_<role>` from the validated token, so no new wiring was needed beyond the one rule.
- The DRIVER/ADMIN ↔ route invariant is enforced once, in `UserAdminService.validateRouteAssignment`, used identically by create (always `resultingActive=true`, since created users are always active) and update (`resultingActive=request.active()`): ADMIN must have no route; an active DRIVER must have an active, same-tenant route; an *inactive* DRIVER may be left without one. A route can't be deactivated while any active DRIVER still references it (`UserRepository.existsByRouteIdAndActiveTrueAndRole`).
- Self-protection (an admin can't deactivate or demote themselves) is a plain equality check against the authenticated principal's own user ID in `UserAdminService.update`, not a permission-framework feature — deliberately simple, per this phase's explicit "no complex permission hierarchy" boundary.
- Password reset revokes every existing refresh-token session for that user (`RefreshTokenService.revokeAllForUser`, a new bulk operation) but leaves any still-valid access token alone, consistent with the existing Phase 2B decision not to re-check active-status per request — the user's *next* refresh attempt (not their current access token) is where a reset actually takes effect.
- `User`/`Route` gained explicit full-replace `update(...)` mutators (matching PUT semantics) — Phase 2B's `User` had none, since no admin CRUD existed yet; both remain otherwise immutable outside their own module.
- The `/admin/users` response DTO field is `name` (matching this phase's explicit request/response spec), while `/auth/me` (Phase 2B) already shipped as `fullName` — a deliberate, minor inconsistency left as-is rather than retroactively renaming an already-approved contract; both map to the same `User.fullName` internally. Worth knowing before building a web client against both.
- `UpdateRouteRequest.active`/`UpdateUserRequest.active` are `@NotNull Boolean`, not primitive `boolean` — found in review: a primitive silently deserializes a missing JSON field to `false`, which would have let an incomplete PUT body deactivate a route or user by accident. The service layer unboxes to a local primitive once, immediately after `@Valid` has already guaranteed non-null, and uses that everywhere else.

**Return domain model (Phase 3A):**

- `returnrecord.ReturnRecord` is the first entity in this codebase to use genuine `@ManyToOne(fetch = LAZY)` JPA associations (to `Tenant`, `User` as driver, `Route`) instead of raw `tenantId`-style UUID columns — a deliberate, explicitly-requested exception to the convention every other entity follows, justified by this being the first entity that references three different aggregate roots at once. The relationships stay strictly unidirectional: none of `Tenant`/`User`/`Route` gained a back-reference collection, and nothing cascades to them. Spring Data's property-path resolution still derives `findByIdAndTenantId(id, tenantId)` correctly against the `tenant` association (resolving to `tenant.id`) with no extra configuration.
- `ReturnRecord.route` is a snapshot of the driver's route **at creation time**, not a live derivation — set once by `ReturnRecordCreator` and never updated afterward, so a later route reassignment never rewrites an existing return's history. Only a direct `route_id` foreign key is stored; no route-code/name snapshot columns were added, since nothing in the current source-of-truth documents requires displaying a route's historical code/name independent of the live `Route` row.
- Return numbers (`RF-000001`, ...) come from one global PostgreSQL sequence (`return_number_seq`), read via a plain native `SELECT nextval(...)` through `EntityManager` — not row counts, timestamps, or in-memory counters, all unsafe under concurrent creation. `String.format("RF-%06d", ...)` zero-pads to a minimum of six digits without ever truncating, so formatting keeps working correctly past `RF-999999` by simply growing wider. One global (not per-tenant) sequence is an intentional MVP simplicity trade-off for the single-company pilot, consistent with this phase's explicit scope.
- `ReturnRecordCreator` is the single place every return-creation rule lives (role/active/route/tenant validation, customer-name/observation normalization, number generation, initial status) specifically so the future driver API (Phase 3B) never has to reimplement them — it takes the caller's already-authenticated `Tenant`/`User` directly and never reads `TenantContext` itself, keeping the domain layer free of any assumption about how the caller authenticated.
- `ReturnRecord`'s constructor is package-private, callable only from `ReturnRecordCreator` (same package) — an additional safeguard beyond what was strictly asked, ensuring no code outside the `returnrecord` package can construct a return while bypassing its validation rules.
- No HTTP exception handler was added for the new domain exceptions (`DriverRequiredException`, `InactiveRouteException`, etc.) — this phase has no controller; Phase 3B maps them to `ProblemDetail` responses when the driver API exists to receive them.
- Testing return-number generation against the exact starting value (`RF-000001`) needs a genuinely pristine `return_number_seq`, which the suite's normal shared/cached Testcontainers context can't guarantee (many test classes reuse one cached container). `ReturnNumberGeneratorFreshDatabaseTest` isolates that one assertion with `@DirtiesContext(classMode = BEFORE_CLASS)`, forcing a fresh context+container before it runs; every other return-number test asserts only relative behavior (increments, uniqueness, format) so it's safe to run in any order against the shared context.
- `ReturnRecordCreator.create()` explicitly rejects a `null` `reason` (`InvalidReasonException`) before any route/route lookup, normalization, number generation, or persistence — found in review: without this guard, a null reason relied entirely on the database's `NOT NULL` constraint as the only backstop, which prevented bad data but leaked a raw persistence exception instead of a clean domain one, inconsistent with every other invalid-input path. Proven by a test that confirms both no row is persisted and no return number is consumed by the rejected attempt (via a before/after relative comparison, not an absolute sequence value).

## Known issues

- Expo SDK 57's CLI (`expo lint`, `expo start`) requires Node `>=20.19.4`; local dev machine runs Node `20.18.0`. Plain `tsc`/`jest` are unaffected. CI (`mobile.yml`) runs Node 22 and is unaffected. Needs a local Node upgrade, not a code change.
- `apps/web`'s pinned toolchain versions (see Architectural decisions) exist for the same underlying Node-version gap; revisit once the local/CI Node baseline moves to `>=20.19`.
- `npm audit` on `apps/mobile` reports moderate/high advisories (`uuid`, `brace-expansion`) — transitive dependencies of Expo's/Jest's own tooling, not fixable without forcing breaking downgrades.
- `AccessTokenServiceTest.tamperedTokenFailsValidation` (Phase 2B, unrelated to Phase 3A) is occasionally flaky: it tampers a token by flipping only its last base64url character, but a JWT signature's final encoded character carries only a couple of significant bits, so for a small fraction of randomly-generated principal UUIDs the flip doesn't actually change the decoded signature bytes and validation still (correctly) fails for other reasons, but the specific assertion can pass or fail depending on that byte. Confirmed via a clean isolated re-run. Not touched in this session — pre-existing, outside Phase 3A's scope.
