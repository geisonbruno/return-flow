# ReturnFlow Incremental Implementation Plan

The project must be developed in small, reviewable phases.

Do not ask Claude Code to build the entire product in one command.

Each phase should:

1. read the relevant `CLAUDE.md`;
2. inspect existing code;
3. implement only the phase;
4. run tests/builds;
5. report changed files;
6. stop for review;
7. create one focused commit after approval.

## Phase 0 — Monorepo scaffold

Goal: create a clean, buildable repository skeleton without business features.

Deliverables:

- root directories and documentation;
- `apps/api` Spring Boot scaffold;
- `apps/web` Vite React TypeScript scaffold;
- `apps/mobile` Expo TypeScript scaffold;
- `infra/docker-compose.yml` for PostgreSQL and MinIO;
- `.vscode/tasks.json`;
- `.editorconfig` and `.gitignore`;
- environment examples;
- independent build/lint/test scripts;
- no authentication or return features.

Acceptance:

- API builds and its basic test passes;
- web builds and typechecks;
- mobile typechecks and starts;
- Docker Compose configuration validates;
- root commands are documented;
- no secret is committed.

Suggested commit:

```text
chore: scaffold ReturnFlow monorepo
```

## Phase 1 — API foundation and persistence

Goal: establish reliable backend foundations.

Deliverables:

- PostgreSQL configuration;
- Flyway baseline;
- health endpoint;
- consistent `ProblemDetail` error structure;
- base audit timestamps;
- tenant entity;
- test profile;
- PostgreSQL integration-test strategy;
- OpenAPI skeleton.

Do not build full authentication or returns.

Suggested commit:

```text
feat(api): add database and application foundation
```

## Phase 2 — Tenant bootstrap, authentication, users, and routes

Goal: allow Air House to authenticate and manage operational users.

Deliverables:

- bootstrap first tenant/admin;
- login/refresh/logout/me;
- password hashing;
- `DRIVER` and `ADMIN`;
- tenant context;
- user activation/deactivation;
- route CRUD;
- driver route assignment;
- tenant isolation tests;
- basic admin and driver authentication shells in clients.

Potential focused commits:

```text
feat(api): add tenant-aware authentication
feat(api): add user and route management
feat(web): add admin authentication shell
feat(mobile): add driver authentication shell
```

## Phase 3 — Return reasons and core return domain

Goal: implement the central domain without photos/PDF.

Deliverables:

- seeded Air House reasons;
- ProductReturn schema;
- return-number generation;
- EA/CTN units;
- driver create/list/detail/update;
- `OTHER` details;
- lifecycle foundation;
- optimistic locking;
- tenant and driver ownership tests.

Suggested commit:

```text
feat(api): add driver return workflow
```

## Phase 4 — Mobile driver workflow

Goal: allow a driver to create and manage return data before adding media.

Deliverables:

- My Returns;
- New Return;
- edit while waiting;
- reason list;
- quantity/unit;
- observations;
- status/read-only behavior;
- network and validation states.

Suggested commit:

```text
feat(mobile): add driver return workflow
```

## Phase 5 — Photos and customer signature

Goal: complete the driver record.

Deliverables:

- storage abstraction;
- MinIO local adapter;
- R2-compatible production adapter;
- mobile photo capture/selection/compression;
- maximum five photos;
- customer representative name;
- customer signature;
- immutable media after review;
- security/file-validation tests.

Suggested commits:

```text
feat(api): add return media storage
feat(mobile): add photos and customer signature
```

## Phase 6 — Web returns list and operational summary

Goal: give admins visibility.

Deliverables:

- dashboard cards;
- latest returns;
- server-paginated list;
- search;
- status/reason/date/driver/route filters;
- return detail view;
- photos and customer signature display.

Suggested commit:

```text
feat(web): add operational returns dashboard
```

## Phase 7 — Warehouse review and concurrency

Goal: complete the operational lifecycle.

Deliverables:

- explicit Start Review;
- review ownership;
- conflict handling;
- release/takeover behavior;
- required Yes/No fields;
- warehouse observation;
- warehouse representative name;
- web signature;
- close;
- cancel;
- terminal immutability;
- API and web tests.

Suggested commits:

```text
feat(api): add warehouse review lifecycle
feat(web): add warehouse review workflow
```

## Phase 8 — User and route management UI

Goal: allow the first admin to operate without developer intervention.

Deliverables:

- users list/create/activate/deactivate;
- driver route assignment;
- routes list/create/edit/activate/deactivate;
- password reset/temporary-password UX.

Suggested commit:

```text
feat(web): add user and route management
```

## Phase 9 — PDF

Goal: preserve the company's printable workflow.

Deliverables:

- server-generated PDF;
- signatures included;
- photos excluded;
- closed-return authorization;
- web download/print action;
- tests;
- licensing review of the chosen library.

Suggested commit:

```text
feat: add closed return PDF
```

## Phase 10 — CI/CD and pilot deployment

Goal: deploy a safe Air House pilot.

Deliverables:

- path-filtered GitHub Actions;
- API build/test/deploy;
- web build/deploy;
- mobile checks;
- managed PostgreSQL;
- R2;
- production secrets;
- backups;
- CORS;
- health checks;
- bootstrap Air House;
- smoke-test checklist.

Revalidate provider pricing and limits immediately before this phase.

Suggested commits:

```text
ci: add independent application pipelines
chore: prepare Air House pilot deployment
```

## Pilot readiness checklist

- tenant isolation verified;
- first Air House admin created;
- routes configured;
- drivers created;
- reason seed verified;
- mobile can create a complete signed return;
- admin can review and close;
- PDF prints correctly;
- no driver can see admin fields;
- no tenant can see another tenant;
- backup exists;
- critical error paths tested;
- recovery/support process documented.

## Post-pilot discovery

After real usage, collect:

- average time to create a return;
- fields users misunderstand;
- frequency of `OTHER`;
- photo usage;
- cancellation causes;
- review bottlenecks;
- demand for notifications;
- demand for offline support;
- ERP-integration need.

Do not add these features before observing the pilot.
