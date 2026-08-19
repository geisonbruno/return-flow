# ReturnFlow — Build and Environment Reference

This document is the source of truth for **how each application is built and what it needs to run**: toolchain versions, build commands, and the environment variables each application reads.

It does not select a hosting provider, describe a deployment procedure, or contain any real value for any variable. Provider selection and the pilot deployment belong to Phase 10B; root `CLAUDE.md` §29 requires those choices to be revalidated immediately before deploying.

**No secret value belongs in this file, in any `.env.example`, or anywhere else in Git.** Only variable *names*, their purpose, and whether they are required are recorded here.

---

## 1. Applications at a glance

| | Backend (`apps/api`) | Web (`apps/web`) | Mobile (`apps/mobile`) |
|---|---|---|---|
| Toolchain | Java 21 (Temurin) | Node 22 | Node 20.19.4 (`.nvmrc`) |
| Package manager | Maven Wrapper (`mvnw`) | npm | npm |
| Build/verify command | `./mvnw package` | `npm run build` | typecheck + lint + tests |
| Build output | `target/api-0.0.1-SNAPSHOT.jar` | `dist/` (static assets) | no binary in Phase 10A |
| CI check name | `Backend CI` | `Web CI` | `Mobile CI` |

The three applications build, test, and deploy independently. There is no root build, and none is wanted (root `CLAUDE.md` §27.1).

---

## 2. Backend — `apps/api`

**Java 21 (Temurin).** Build with the Maven Wrapper, so no globally installed Maven is required:

```bash
cd apps/api
./mvnw package          # Windows: .\mvnw.cmd package
```

`package` runs the full test suite first (Maven's default lifecycle) and then produces the executable Spring Boot jar at `target/api-0.0.1-SNAPSHOT.jar`. Running `mvnw test` separately before `package` only re-runs the same tests.

Integration tests start their own PostgreSQL through **Testcontainers**, so a Docker daemon must be available — but no database needs to be provisioned, and **no credentials or secrets are required to build or test**.

### Runtime profile

The application deliberately refuses to start without an explicit profile, so it can never silently connect to an undefined database:

- `local` — development, via `infra/docker-compose.yml`;
- `prod` — every value comes from the environment, with no committed defaults.

Set with `SPRING_PROFILES_ACTIVE`.

### Backend environment variables

| Variable | Purpose | Classification | Required |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Selects the configuration profile (`local` / `prod`) | Runtime, non-secret | **Yes** — startup fails without a profile |
| `DATABASE_URL` | JDBC URL of the PostgreSQL instance | Runtime, non-secret | **Yes** in `prod` |
| `DATABASE_USERNAME` | Database user | Runtime **secret** | **Yes** in `prod` |
| `DATABASE_PASSWORD` | Database password | Runtime **secret** | **Yes** in `prod` |
| `ACCESS_TOKEN_SECRET` | HMAC signing key for access tokens; minimum 32 bytes | Runtime **secret** | **Yes** in `prod` |
| `RETURN_MEDIA_STORAGE_ROOT` | Filesystem path for return photos and signature images | Runtime, non-secret | **Yes** in `prod` |
| `OPERATIONS_BUSINESS_TIMEZONE` | Business timezone for the ADMIN operational day | Runtime, non-secret | No — defaults to `Australia/Sydney` |
| `BOOTSTRAP_ADMIN_EMAIL` | Email of the first `ADMIN` to provision | Runtime, non-secret | No — see below |
| `BOOTSTRAP_ADMIN_NAME` | Full name of that first `ADMIN` | Runtime, non-secret | No — see below |
| `BOOTSTRAP_ADMIN_PASSWORD` | Initial password for that first `ADMIN` | Runtime **secret** | No — see below |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_PORT` | Local Docker Compose database only | Development-only | No — defaults in `infra/.env.example` |

Notes that matter in production:

- **`ACCESS_TOKEN_SECRET`** has a clearly-labelled development/test-only default in `application.properties` so plain tests can boot. `application-prod.properties` overrides it with **no** default, so production can never silently run on the committed placeholder.
- **`RETURN_MEDIA_STORAGE_ROOT` must point at durable storage.** A container filesystem is ephemeral: every uploaded photo and signature is lost on the next restart or deploy. No object-storage adapter exists yet — the filesystem adapter sits behind the replaceable `ReturnMediaStorage` interface, and a Cloudflare R2/S3 adapter is the intended successor (root `CLAUDE.md` §14, §29).
- **The bootstrap admin is disabled unless all three `BOOTSTRAP_ADMIN_*` values are set together.** It is idempotent and intended for first provisioning only.

---

## 3. Web — `apps/web`

**Node 22.** Build the deployable static assets:

```bash
cd apps/web
npm ci
npm run lint
npm run typecheck
npm test
npm run build       # outputs dist/
```

`dist/` contains plain static files and can be served by any static host or CDN. There is no server-side rendering and no Node runtime in production.

### Web environment variables

| Variable | Purpose | Classification | Required |
|---|---|---|---|
| `VITE_API_BASE_URL` | Absolute base URL the browser calls for the API, including `/api/v1` | **Build-time, public** | No — see below |

- Anything prefixed `VITE_` is **compiled into the published JavaScript bundle and is therefore public**. Never put a secret in a `VITE_` variable.
- Left unset, the app calls the relative path `/api/v1`. In development the Vite dev server proxies that to `http://localhost:8080`, so no backend CORS change is needed.
- Set it when the web app and the API are served from **different origins**, which is the expected deployment shape. Because it is build-time, changing it requires a rebuild — it cannot be adjusted by restarting a running server.

---

## 4. Mobile — `apps/mobile`

**Node 20.19.4**, pinned in `apps/mobile/.nvmrc` — this is the single source both the local toolchain and CI read. Expo tooling refuses to run on an older Node, so the pin is a hard requirement rather than a preference.

```bash
cd apps/mobile
npm ci
npm run typecheck
npm run lint
npm test -- --ci --runInBand
```

**Phase 10A intentionally does not produce a signed mobile binary.** There is no EAS/cloud build, no Android or iOS signing, and no store deployment: those depend on pilot-distribution decisions that belong to Phase 10B. CI readiness for mobile means the source is verified — typecheck, lint, and tests — not that an installable artifact is published.

`npx expo-doctor` remains a manual dependency-health check, deliberately not a CI step; see `docs/DEVELOPMENT_WORKFLOW.md`.

### Mobile environment variables

| Variable | Purpose | Classification | Required |
|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL of the API, no trailing slash | **Runtime, public** | **Yes** |

- Anything prefixed `EXPO_PUBLIC_` is **embedded in the built app and is therefore public**. Never put a secret in one.
- A physical device cannot reach a development machine via `localhost` — that resolves to the phone itself. Use the machine's LAN address during development. See `apps/mobile/.env.example`.

---

## 5. Secrets policy

- No real secret is committed. `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, and `infra/.env`, while allowing `*.env.example`.
- `.env.example` files document **names and shapes only**, never working values, and never anything shaped like a real production credential.
- **CI requires no secrets at all.** The three workflows check out the repository, install pinned dependencies, and run build/test commands — nothing more. They read no repository or environment secret, so there is nothing for a workflow log to leak, and this should stay true: if a future check appears to need a production credential, that is a signal the check is doing deployment work rather than verification.
- Production values are supplied by the deployment platform's own secret storage, chosen in Phase 10B.

---

## 6. Continuous integration

Three independent workflows — a backend change never runs the mobile suite, and vice versa:

| Workflow | Check name | Expensive validation runs when these paths changed |
|---|---|---|
| `.github/workflows/backend.yml` | `Backend CI` | `apps/api/**`, the workflow file itself |
| `.github/workflows/web.yml` | `Web CI` | `apps/web/**`, the workflow file itself |
| `.github/workflows/mobile.yml` | `Mobile CI` | `apps/mobile/**`, the workflow file itself |

All three workflows **start** for every Pull Request targeting `main`, so all three checks always report and can safely be required by branch protection. Each one then decides for itself whether the expensive work is needed, by comparing the Pull Request's real base and head SHAs with `git diff` — no third-party path-filter action. A Pull Request that changed nothing relevant to an application logs a short "validation not required" line and finishes that check successfully without installing a toolchain or running a suite.

Push to `main` keeps an ordinary workflow-level `paths:` filter, since required-check reporting is only a Pull Request concern. A manual `workflow_dispatch` always runs the real validation.

Documentation-only changes (`README.md`, `PROGRESS.md`, `CLAUDE.md`, `docs/**`) therefore complete all three checks without building anything, because no application build depends on them.

Every CI command above is the same command a developer runs in a normal terminal — no IDE is required anywhere, and nothing in the build depends on a developer-local file.

> **One reproducibility detail:** `npm run lint` (oxlint) discovers its ignore rules from the surrounding Git working tree, so it must be run inside a checkout of the repository rather than against a bare copy of `apps/web`. `actions/checkout` satisfies this, as does any normal local clone.

See `docs/DEVELOPMENT_WORKFLOW.md` for branch protection and which checks should be required before merging.
