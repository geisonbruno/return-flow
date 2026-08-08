# ReturnFlow — Development Workflow

This document is the source of truth for how work moves from a task into `main`: branching, commits, Pull Requests, CI, and releases. It does not define product, architecture, or roadmap decisions — those live in the root `CLAUDE.md` and `docs/IMPLEMENTATION_PLAN.md`.

`main` is the repository's protected default branch. Every change reaches it through a Pull Request, never a direct push.

## The approved workflow

1. Update local `main` (`git switch main && git pull`).
2. Create a focused feature, fix, or chore branch from `main` (see naming below).
3. Claude implements and validates the requested scope on that branch, without committing.
4. The developer (and any reviewer) inspects the resulting HANDOFF SUMMARY.
5. A separate, explicit approval prompt creates the commit on that branch.
6. The developer pushes the feature branch.
7. The developer opens a Pull Request targeting `main`.
8. GitHub Actions runs the two required checks on the Pull Request: **Backend CI** (`mvnw package`, which runs the full backend test suite first) and **Mobile CI** (`npm ci`, then typecheck, lint, and tests — all blocking).
9. Any failure is corrected on the same branch — never by reopening a new one for the same task.
10. The Pull Request is merged only after the required checks pass.
11. The merged feature branch is deleted.
12. Local `main` is updated before the next task begins.

### Branch naming

- `feat/<short-description>` — new product functionality.
- `fix/<short-description>` — a defect correction.
- `chore/<short-description>` — tooling, CI, dependency, or repository-governance work.
- `docs/<short-description>` — documentation-only changes.

Examples: `feat/phase-5b-customer-signature`, `fix/web-photo-upload`, `chore/ci-governance`.

### Rules that always apply

- Never implement directly on `main`.
- Never commit automatically immediately after implementation — an explicit, separate approval step creates the commit.
- Review remains required before that commit is created; CI passing is not itself approval.
- Claude must not push a branch, open a Pull Request, merge, tag, or deploy unless explicitly instructed to do so in that specific task.
- CI verifies executable quality (tests, typecheck, lint, build) — it does not replace human product and architecture review.
- A failed required check blocks merge.
- Database migrations are forward-only; a migration is never edited after it merges.
- One focused task should normally produce one focused commit.
- Unrelated refactoring must not be mixed into feature work — open a separate `chore`/`fix` task instead.

## Dependency health (Expo Doctor)

`npx expo-doctor` (`apps/mobile`) is a maintenance check, not a required CI check. It is deliberately **not** run in `.github/workflows/ci.yml` — a permanently-informational, always-passing CI step was considered and rejected, since a check that can never fail the build isn't providing real signal, and `Mobile CI` should only contain steps that block meaningfully.

Run it manually:

- before an Expo SDK upgrade;
- when adding a native dependency;
- before creating a development or production build;
- before the first pilot release;
- during a dedicated, reviewed dependency-maintenance task.

The project currently reports 17/18 (Expo-managed dependency-version drift; see `PROGRESS.md` Known Issues for the exact packages and the peer-dependency conflict that blocks an automatic fix). `--legacy-peer-deps` and `--force` are not accepted as routine fixes for this — a real dependency-maintenance task should resolve the underlying conflict instead. Expo Doctor is added back to `Mobile CI` as a **blocking** step only once the project safely reaches 18/18.

## Main branch protection

Branch protection is **not** configured yet. It must be configured manually, in the GitHub repository settings, after the CI workflow (`.github/workflows/ci.yml`) has run successfully at least once — GitHub only offers a status check as a selectable required check after it has reported at least one result.

Recommended rules for this solo-developed MVP (target branch: `main`):

- Require a Pull Request before merging.
- Do **not** require an approving review while there is only one repository developer — introduce this once a second collaborator joins.
- Require status checks to pass before merging:
  - `Backend CI`
  - `Mobile CI`
- Block force pushes to `main`.
- Block branch deletion for `main`.
- Require conversation resolution before merging.
- Apply the rules to repository administrators too, where the GitHub plan allows it.
- Do **not** require signed commits yet.
- Do **not** require a merge queue yet — unnecessary at this repository's current change volume.
- Do **not** require deployment checks — no deployment exists yet.
- Do **not** require CODEOWNERS — unnecessary with one developer.

These settings have not been enabled as of this document. Treat this section as instructions for the next manual configuration step, not a record of what is already active.

## Local Development Startup

**First-time setup:** copy `dev.local.ps1.example` (repository root) to `dev.local.ps1` and set local bootstrap-admin values there if you want a first `ADMIN` provisioned automatically.

**Daily startup**, from the repository root:

```powershell
.\dev.ps1
```

This starts PostgreSQL and MinIO (`docker compose -f infra/docker-compose.yml up -d`), runs the Spring Boot API locally (`apps/api`, `local` profile, via the Maven Wrapper — no globally installed Maven needed) in its own visible window, and runs the Vite dev server (`apps/web`) in its own visible window, so the developer never has to remember the separate Docker/Maven/npm commands individually.

- `dev.local.ps1` is ignored by Git — bootstrap credentials (`BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD`/`NAME`) are never source-controlled, and the script never prints `BOOTSTRAP_ADMIN_PASSWORD`.
- The bootstrap is idempotent by normalized email: once an `ADMIN` with that email exists locally, changing `BOOTSTRAP_ADMIN_PASSWORD` later does not reset it. It remains a local/first-admin provisioning mechanism only, never a public signup endpoint.
- An already-running ReturnFlow backend or web dev server is detected and reused, not duplicated.
- If a required port (`8080` or `5173`) is occupied by something that isn't ReturnFlow, the script stops safely and reports it rather than killing that process or picking a different port.
- `npm install` in `apps/web` (and any other first-time dependency install) remains a manual, one-time step — `dev.ps1` never installs dependencies.

## Release strategy

- Individual phases and commits are **not** tagged. Phase numbers (e.g. "Phase 5A") are internal development milestones tracked in `PROGRESS.md`, not release identifiers.
- The first release tag will be **`v0.1.0`**, created when the MVP is ready for its first real Warehouse pilot — not at the end of any specific phase.
- Patch fixes after that use `v0.1.1`, `v0.1.2`, and so on.
- Later backward-compatible feature releases use `v0.2.0`, `v0.3.0`, and so on.
- `v1.0.0` is reserved for the first version considered stable for broader production use beyond the initial pilot.
- When releases begin, use annotated Git tags and a corresponding GitHub Release with notes.
- No tag exists yet, and none is created by routine feature/fix/chore work. Automated release publishing is not built yet either — this section documents the intended scheme, not an active pipeline.
