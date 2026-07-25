# First Prompt for Claude Code

Use this prompt after creating/opening the empty `returnflow` repository and placing the blueprint files in it.

---

You are starting the ReturnFlow project.

Before changing anything:

1. Read `/CLAUDE.md`.
2. Read:
   - `/apps/api/CLAUDE.md`
   - `/apps/web/CLAUDE.md`
   - `/apps/mobile/CLAUDE.md`
   - `/docs/DIAGRAMS.md`
   - `/docs/IMPLEMENTATION_PLAN.md`
3. Summarize the architecture and exact scope of Phase 0.
4. Inspect the repository.

Then implement **Phase 0 — Monorepo scaffold only**.

Create a simple polyglot monorepo with:

```text
returnflow/
├── CLAUDE.md
├── README.md
├── BOOTSTRAP_PROMPT.md
├── apps/
│   ├── api/
│   ├── web/
│   └── mobile/
├── docs/
├── infra/
├── scripts/
├── .github/workflows/
└── .vscode/
```

## API

Create `apps/api` as a normal standalone Maven Spring Boot project.

Use:

- Java 21;
- a stable Spring Boot release compatible with Java 21 at creation time;
- Maven Wrapper;
- package base `com.returnflow`;
- a minimal health/testable application only;
- no authentication, tenant, user, route, or return implementation yet.

The API must build from its own directory using the Maven Wrapper.

## Web

Create `apps/web` with React, TypeScript, and Vite.

Include:

- strict TypeScript;
- lint;
- typecheck;
- test script;
- minimal placeholder shell only;
- no dashboard or business screens.

## Mobile

Create `apps/mobile` with Expo and TypeScript.

Include:

- minimal navigation-ready structure;
- lint;
- typecheck;
- test script if practical with the selected current Expo setup;
- placeholder screen only;
- no login or return form.

## Infrastructure

Create `infra/docker-compose.yml` with:

- PostgreSQL for local development;
- MinIO or another simple S3-compatible local service;
- persistent local volumes;
- safe development defaults;
- documented environment variables.

Do not add production secrets.

## Developer experience

Create:

- root `.editorconfig`;
- root `.gitignore`;
- environment example files;
- `.vscode/tasks.json` for infrastructure, API, web, and mobile;
- concise root `README.md` with Windows PowerShell commands;
- placeholder path-filtered workflow files only if they are valid and useful at this stage.

Do not add Nx, Turborepo, Bazel, a root Maven multi-module build, microservices, Dockerized application builds, or business features.

## Validation

- run API tests/build;
- run web lint/typecheck/build;
- run mobile typecheck and the safest available noninteractive checks;
- validate Docker Compose configuration;
- report any command that cannot be run and why.

At the end:

1. List every created/changed file.
2. List commands executed and results.
3. Explain version choices.
4. Confirm that no business feature was implemented.
5. Suggest the exact commit message: `chore: scaffold ReturnFlow monorepo`.
6. Stop and wait for review. Do not begin Phase 1.
