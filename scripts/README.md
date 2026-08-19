# Scripts

Cross-app repository automation. These are dependency-free shell scripts — no npm, Python, or Ruby runtime is required — so they behave identically on a developer machine and on a GitHub Ubuntu runner.

Each app still builds, lints, and tests independently through its own package manager (see the root `README.md`).

## `validate-commit-messages.sh`

Validates the commit-message policy in `docs/DEVELOPMENT_WORKFLOW.md`: every non-merge commit needs a subject, a blank line, and a descriptive body. Trailers such as `Co-Authored-By` or `Claude-Session` do not count as the body. Merge commits are skipped.

```bash
scripts/validate-commit-messages.sh <base-sha> <head-sha>

# Check your branch against main before opening a Pull Request:
scripts/validate-commit-messages.sh origin/main HEAD
```

Exits non-zero and names each offending commit when validation fails. `Commit Message CI` (`.github/workflows/commit-message.yml`) runs this same script on every Pull Request.

## `test-validate-commit-messages.sh`

Tests the validator by building throwaway Git histories in a temporary directory and running the real script against them. It touches no repository history.

```bash
scripts/test-validate-commit-messages.sh
```
