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
8. GitHub Actions runs the checks that apply to what the branch actually changed — **Backend CI**, **Web CI**, and/or **Mobile CI** (see Continuous integration below). All are blocking.
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

## Continuous integration

Three independent workflows, one per application:

| Workflow | Check name | Expensive validation runs when these paths changed | What it runs |
|---|---|---|---|
| `.github/workflows/backend.yml` | `Backend CI` | `apps/api/**`, itself | `mvnw package` (runs the full backend suite, then builds the jar) |
| `.github/workflows/web.yml` | `Web CI` | `apps/web/**`, itself | `npm ci`, lint, typecheck, tests, production build |
| `.github/workflows/mobile.yml` | `Mobile CI` | `apps/mobile/**`, itself | `npm ci`, typecheck, lint, tests |

These replaced the earlier combined `ci.yml`, which ran Backend CI and Mobile CI on *every* change — including documentation-only ones. The job names `Backend CI` and `Mobile CI` were kept identical across that split so any existing required-check configuration keeps working; `Web CI` is a new stable name, replacing the incidental `build-and-test`.

### How path filtering and required checks work together

**All three workflows start for every Pull Request targeting `main`, so all three checks always report a result.** Only the validation itself is conditional.

This matters because of how GitHub behaves in two different situations:

- A workflow that never starts — because a workflow-level `paths:` filter excluded it — never reports. A required check in that state stays pending forever and blocks the Pull Request.
- A step or job skipped *inside* a workflow that did start still reports a successful conclusion, which satisfies a required check.

So the Pull Request triggers carry no `paths:` filter. Instead, each workflow's first step compares the Pull Request's real base and head SHAs (`git diff --name-only`, using `github.event.pull_request.base.sha` and `.head.sha` rather than the synthetic merge commit, which would also surface changes that came from `main`). If nothing relevant changed, the job logs a short "validation not required" line and finishes successfully without installing a toolchain or running a suite.

The result:

| Pull Request touches | `Backend CI` | `Web CI` | `Mobile CI` |
|---|---|---|---|
| `apps/api/**` only | full validation | reports success, no work | reports success, no work |
| `apps/web/**` only | reports success, no work | full validation | reports success, no work |
| `apps/mobile/**` only | reports success, no work | reports success, no work | full validation |
| more than one application | each affected application runs its full validation | | |
| documentation only | reports success, no work | reports success, no work | reports success, no work |

**Push to `main` keeps a workflow-level `paths:` filter.** Required-check reporting is a Pull Request concern, so there is nothing to gain from starting a workflow for an unrelated push. A manual `workflow_dispatch` always runs the real validation.

No third-party path-filter action is used — the detection is a few lines of `git diff` and `grep`.

Each workflow uses least privilege (`permissions: contents: read`), cancels only its own superseded runs, and uses only the official `actions/checkout`, `actions/setup-java`, and `actions/setup-node` actions with their built-in dependency caching. **No workflow uses any secret, writes to the repository, or deploys anything.**

Build commands, toolchain versions, and every environment variable each application reads are documented in [`docs/BUILD_AND_ENVIRONMENT.md`](BUILD_AND_ENVIRONMENT.md).

## Dependency health (Expo Doctor)

`npx expo-doctor` (`apps/mobile`) is a maintenance check, not a required CI check. It is deliberately **not** run in `.github/workflows/mobile.yml` — a permanently-informational, always-passing CI step was considered and rejected, since a check that can never fail the build isn't providing real signal, and `Mobile CI` should only contain steps that block meaningfully.

Run it manually:

- before an Expo SDK upgrade;
- when adding a native dependency;
- before creating a development or production build;
- before the first pilot release;
- during a dedicated, reviewed dependency-maintenance task.

The project currently reports 17/18 (Expo-managed dependency-version drift; see `PROGRESS.md` Known Issues for the exact packages and the peer-dependency conflict that blocks an automatic fix). `--legacy-peer-deps` and `--force` are not accepted as routine fixes for this — a real dependency-maintenance task should resolve the underlying conflict instead. Expo Doctor is added back to `Mobile CI` as a **blocking** step only once the project safely reaches 18/18.

## Main branch protection

`main` is protected by a repository **ruleset**, configured once `Backend CI`, `Web CI`, and `Mobile CI` had each reported at least one result — GitHub only offers a status check as selectable after that.

Active rules for `main`:

- A Pull Request is required; no direct pushes.
- These status checks must pass before merging:
  - `Backend CI`
  - `Web CI`
  - `Mobile CI`
- Required approvals: **0**, for the current single-developer MVP workflow.
- Force pushes are blocked.
- Branch deletion is restricted.
- **"Require branches to be up to date before merging" is intentionally disabled**, trading a small risk of semantic conflict for not re-running every check after each intervening merge.
- No bypass is intended for the normal workflow.

Requiring all three checks is safe specifically because every one of these workflows starts for every Pull Request targeting `main`, so each always reports a result even when its application was untouched (see Continuous integration above). There is no "required but never reported" deadlock, and no reason to routinely bypass a check as an administrator.

Two settings are deliberately relaxed and should be revisited when the team grows: **required approvals** becomes meaningful only with a second developer (self-approval is not review), and the branch-up-to-date requirement becomes worth its cost as merge volume rises.

Still deliberately not enabled: signed commits, a merge queue (unnecessary at this change volume), deployment checks (no deployment exists yet), and CODEOWNERS (unnecessary with one developer).

## Local Development Startup

**First-time setup:** copy `dev.local.ps1.example` (repository root) to `dev.local.ps1` and set local bootstrap-admin values there if you want a first `ADMIN` provisioned automatically.

**Daily startup**, from the repository root:

```powershell
.\dev.ps1
```

This starts PostgreSQL and MinIO (`docker compose -f infra/docker-compose.yml up -d`), runs the Spring Boot API locally (`apps/api`, `local` profile, via the Maven Wrapper — no globally installed Maven needed) in its own visible window, and runs the Vite dev server (`apps/web`) attached directly to the same terminal you ran `.\dev.ps1` from — not a separate window — so the developer never has to remember the separate Docker/Maven/npm commands individually.

- `dev.local.ps1` is ignored by Git — bootstrap credentials (`BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD`/`NAME`) are never source-controlled, and the script never prints `BOOTSTRAP_ADMIN_PASSWORD`.
- The bootstrap is idempotent by normalized email: once an `ADMIN` with that email exists locally, changing `BOOTSTRAP_ADMIN_PASSWORD` later does not reset it. It remains a local/first-admin provisioning mechanism only, never a public signup endpoint.
- An already-running ReturnFlow backend or web dev server is detected and reused, not duplicated.
- If a required port (`8080` or `5173`) is occupied by something that isn't ReturnFlow, the script stops safely and reports it rather than killing that process or picking a different port.
- `npm install` in `apps/web` (and any other first-time dependency install) remains a manual, one-time step — `dev.ps1` never installs dependencies.
- Vite's logs print in the same terminal and it keeps running there after the script finishes and returns control to you. Ctrl+C in that terminal stops Vite only — the backend keeps running in its own separate window, unaffected.

## Release strategy

- Individual phases and commits are **not** tagged. Phase numbers (e.g. "Phase 5A") are internal development milestones tracked in `PROGRESS.md`, not release identifiers.
- The first release tag will be **`v0.1.0`**, created when the MVP is ready for its first real Warehouse pilot — not at the end of any specific phase.
- Patch fixes after that use `v0.1.1`, `v0.1.2`, and so on.
- Later backward-compatible feature releases use `v0.2.0`, `v0.3.0`, and so on.
- `v1.0.0` is reserved for the first version considered stable for broader production use beyond the initial pilot.
- When releases begin, use annotated Git tags and a corresponding GitHub Release with notes.
- No tag exists yet, and none is created by routine feature/fix/chore work. Automated release publishing is not built yet either — this section documents the intended scheme, not an active pipeline.
