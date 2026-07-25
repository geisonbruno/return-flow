# ReturnFlow — Progress

## Current phase

Phase 2 — Tenant bootstrap, authentication, users, and routes. Not yet started.

Phase 0 (Monorepo scaffold) and Phase 1 (Backend foundation) are both **reviewed and approved** by the developer.

## Current task

Finalizing Git history for the approved Phase 0 + Phase 1 work: this documentation update, followed by the implementation commit(s), followed by a short documentation commit recording the resulting hash(es). Phase 2 has not started and will not start until a separate task requests it.

## Review status

- Phase 0 — Monorepo scaffold — **approved**.
- Phase 1 — Backend foundation — **approved**.

## Completed phases

- Phase 0 — Monorepo scaffold (approved 2026-07-26).
- Phase 1 — Backend foundation (approved 2026-07-26).

## Pending phases

- Phase 2 — Tenant bootstrap, authentication, users, and routes
- Phase 3 — Return reasons and core return domain
- Phase 4 — Mobile driver workflow
- Phase 5 — Photos and customer signature
- Phase 6 — Web returns list and operational summary
- Phase 7 — Warehouse review and concurrency
- Phase 8 — User and route management UI
- Phase 9 — PDF
- Phase 10 — CI/CD and pilot deployment

## Current status

All three apps scaffold, build, and pass their checks; the API additionally has a working database/migration/error-handling/OpenAPI foundation:

- `apps/api`: Spring Boot 4.1.0 / Java 21. `mvnw test` (4/4, Testcontainers-backed) and `mvnw package` pass. PostgreSQL + Flyway + Hibernate-validate + `ProblemDetail` error handling + OpenAPI + Actuator all in place (Phase 1). No business/tenant code yet, by design.
- `apps/web`: Vite + React 19 + TypeScript (strict). `lint`, `typecheck`, `build`, `test` all pass.
- `apps/mobile`: Expo SDK 57 + TypeScript (strict). `typecheck` and `test` pass. `lint`/`expo start` remain blocked by a local Node version gate — see Known issues.
- `infra/docker-compose.yml`: Postgres 16 + MinIO, both verified healthy. **Postgres now defaults to host port `5433`** (container-internal port is still the standard `5432`) — see "Local PostgreSQL host port decision" below.
- Dev experience: root `.editorconfig`, `.gitignore`, `.vscode/tasks.json`, path-filtered GitHub Actions, env `.env.example` files, root/app READMEs — all consistent with the port change.

Full command-by-command validation evidence for each phase lives in the chronological history below; this section intentionally stays high-level.

## Local PostgreSQL host port decision

**Decision:** the ReturnFlow Docker Compose PostgreSQL service defaults to host port **5433** for local development (`infra/docker-compose.yml`, `infra/.env.example`, `apps/api/application-local.properties`, root `CLAUDE.md` §28 all updated together). The container's internal Postgres port is unchanged (`5432`); only the host-side mapping moved, and it remains fully overridable via the existing `POSTGRES_PORT` environment variable.

**Why:** this development machine runs a native Windows PostgreSQL service that was already bound to host port 5432, colliding with Docker's port-forwarding for the same port. Host-network connections to `localhost:5432` could silently land on the native instance instead of the Docker one (different/unknown credentials, connection failures), even though the Docker container itself was always healthy — confirmed in the Phase 1 session and again here. Changing the *project's* default host port sidesteps the conflict without touching the native service (explicitly out of scope — it may be used by other things on this machine) and without hardcoding anything: `POSTGRES_PORT` remains a normal override for any developer whose machine doesn't have this conflict.

**Re-validated 2026-07-26** with no manual override needed (see Chronological history): `docker compose up -d` on the new default, `mvnw spring-boot:run -Dspring-boot.run.profiles=local` connected on the first attempt, `/actuator/health` reported `db: UP` immediately.

## Important architectural decisions

**Phase 0:**

- Spring Boot 4.1.0 + Java 21 (current stable at scaffold time, per start.spring.io metadata).
- `apps/web` scaffolded with the current Vite `react-ts` template, which now ships **oxlint** (not ESLint) and **rolldown-vite** by default. `vite`, `@vitejs/plugin-react`, and `oxlint` were pinned to slightly older minor versions (`vite@6.4.3`, `@vitejs/plugin-react@4.3.4`, `oxlint@1.16.0`) because their latest releases hard-require Node `^20.19.0`, which trips an unrelated npm optional-dependency bug on this machine's Node 20.18.0. `jsdom` pinned to `25.0.1` for the same reason. All can be bumped back to latest once the local/CI Node baseline is >=20.19.
- `apps/mobile` uses the Expo **blank-typescript** template (not tabs/expo-router) to avoid pulling in a navigation library before it's needed.
- MinIO pinned to `RELEASE.2025-09-07T16-13-09Z` (not `:latest`) for reproducibility; Postgres pinned to `16-alpine`.

**Phase 1:**

- **No tenant entity, despite `docs/IMPLEMENTATION_PLAN.md` listing "tenant entity" under Phase 1 deliverables.** The Phase 1 task description given for that session was explicit: "No authentication, tenant logic, users, routes, returns, or business rules should be implemented during this phase," with tenants explicitly out of scope. A direct, detailed instruction for the current phase takes precedence over the higher-level phase description in the implementation plan. The Flyway/JPA/error-handling/OpenAPI/Actuator foundation is ready for the tenant entity to land cleanly at the start of Phase 2.
- **No datasource in the base `application.properties`, by design.** Requiring an explicit `local` or `prod` profile means the app can never silently connect to an undefined or wrong database — it fails fast instead. Trade-off: `mvnw spring-boot:run` requires `-Dspring-boot.run.profiles=local` (documented in both READMEs and `.vscode/tasks.json`).
- **`application-local.properties` hardcodes the same non-secret dev credentials already committed in `infra/.env.example`** (`returnflow`/`returnflow`, env-var overridable) — not a "hardcoded credential" violation since these are throwaway local Postgres credentials already public in the repo. `application-prod.properties` has no defaults at all; it fails to start without `DATABASE_URL`/`DATABASE_USERNAME`/`DATABASE_PASSWORD` from the real deployment environment.
- **PostgreSQL integration-test strategy uses Testcontainers**, not a static test datasource or a manually-started database. `TestcontainersConfiguration` (`@ServiceConnection PostgreSQLContainer`) is imported by any `@SpringBootTest` that needs a real database, so `mvnw test` is self-contained and identical in local dev and CI.
- **springdoc-openapi pinned to `3.0.3`** — the first stable major version compatible with Spring Boot 4.x/OpenAPI 3.1; not managed by Spring Boot's own BOM, so it needs an explicit version.
- **Several Spring Boot 4.1 / Testcontainers 2.0 artifact and package renames were discovered empirically** against real build failures, not guessed:
  - Flyway now requires the dedicated `spring-boot-starter-flyway` starter plus `flyway-database-postgresql` for Postgres support.
  - Testcontainers 2.0 renamed its modules with a `testcontainers-` prefix (`org.testcontainers:testcontainers-junit-jupiter`, `org.testcontainers:testcontainers-postgresql`).
  - `@WebMvcTest`/`@AutoConfigureMockMvc` moved to `org.springframework.boot.webmvc.test.autoconfigure`.
  - `SpringPhysicalNamingStrategy` was removed entirely in Boot 4; Hibernate's own default naming strategy already produces this project's `snake_case` convention, so nothing was lost by not setting it.
  - `HibernateJpaConfiguration` and friends now live under `org.springframework.boot.hibernate.autoconfigure`.

**Finalization (this session):** the local PostgreSQL host port decision above is the only architectural change made while closing out Phases 0–1; no new product functionality or capability was introduced, per this task's explicit scope.

## Known issues

- **Expo CLI Node gate**: Expo SDK 57's CLI (`expo lint`, `expo start`) hard-refuses to run on Node < 20.19.4; local dev machine is on Node 20.18.0. Plain `tsc`/`jest` are unaffected and pass. CI (`mobile.yml`) runs on Node 22 and is unaffected. Confirmed exact failure text:
  ```
  Node.js (v20.18.0) is outdated and unsupported. Please update to a newer Node.js LTS version (required: >=20.19.4)
  Go to: https://nodejs.org/en/download
  ```
  Requires a local Node upgrade, not a code change. Still unresolved as of this session (out of scope for this task — no mobile work was performed here).
- Local Node (20.18.0) is one patch below what the newest JS toolchain (Vite 8/oxlint 1.20+/jsdom 27+) wants; addressed for `apps/web` via version pinning rather than requiring an immediate Node upgrade.
- `npm audit` on `apps/mobile` reports moderate/high advisories (`uuid`, `brace-expansion`) that are transitive dependencies of Expo's/Jest's own tooling — not fixable without forcing breaking downgrades. Left as-is; revisit if upstream releases a fix.
- ~~Local machine's native Windows PostgreSQL service conflicts with the Docker Compose Postgres port mapping on 5432.~~ **Resolved at the project level this session** — see "Local PostgreSQL host port decision" above. The native service itself was intentionally left untouched.

## Chronological implementation history

- 2026-07-25 — **Phase 0 implemented and validated** (monorepo scaffold: `apps/api` Spring Boot, `apps/web` Vite React TS, `apps/mobile` Expo TS, `infra/docker-compose.yml`, dev-experience files). Re-validated end-to-end after an intervening machine restart (Docker Desktop WSL hiccup, resolved) with identical results. All checks passed except the Expo CLI's `lint`/`start`, blocked by the Node version gate (see Known issues). Full original command list preserved in Git history of this file if needed; summarized here since the phase is now approved.
- 2026-07-25 — **Phase 1 implemented and validated** (backend foundation in `apps/api`: PostgreSQL + Spring Data JPA, Flyway as the sole migration mechanism with a comment-only baseline migration, Hibernate `ddl-auto=validate`, UTC timestamps, global `ProblemDetail` error handling, OpenAPI via springdoc with build-info-sourced metadata, Actuator health/info, and a Testcontainers-based integration-test strategy). Hit and fixed several real Spring Boot 4.1/Testcontainers 2.0 breaking changes along the way (see Architectural decisions). `mvnw test` 4/4 pass, `mvnw package` BUILD SUCCESS, manual local-profile smoke test confirmed health/OpenAPI/Flyway all correct. Discovered (but did not fix, machine-configuration issue) the native-Postgres port-5432 conflict.
- 2026-07-26 — **Phases 0 and 1 reviewed and approved by the developer.** This session formally closes them out:
  - Resolved the Postgres port conflict at the project level (see "Local PostgreSQL host port decision"): `infra/docker-compose.yml` and `infra/.env.example` now default `POSTGRES_PORT` to `5433`; `apps/api/application-local.properties` and root `CLAUDE.md` §28 updated to match. The native Windows Postgres service was not touched.
  - Re-ran validation with Docker running throughout:
    - `docker compose config --quiet` — valid.
    - `docker compose down` + `docker compose up -d` in `infra/` — `returnflow-postgres` and `returnflow-minio` both came up **healthy**, Postgres now published on host port **5433**.
    - `apps/api`: `.\mvnw.cmd test` — **4/4 pass** (Testcontainers-backed, unaffected by the host port change by construction). `.\mvnw.cmd package` — **BUILD SUCCESS**.
    - Manual smoke test: `.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local` with **no manual port override** — started cleanly on the first attempt. `GET /actuator/health` → `200`, `db` sub-status `UP`. `GET /v3/api-docs` → correct title/description/version. `flyway_schema_history` in the real database confirmed migration `1 - baseline` applied successfully.
  - This documentation update. Implementation commit(s) and their hashes are recorded immediately below once created — see "Git history" section.

## Git history

- Commit strategy and resulting hash(es) for the approved Phase 0 + Phase 1 work will be recorded here immediately after the commit(s) are created in this same session — see the commit(s) below.
