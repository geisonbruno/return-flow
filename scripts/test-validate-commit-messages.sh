#!/usr/bin/env bash
#
# Tests for scripts/validate-commit-messages.sh.
#
# Builds throwaway Git histories in a temporary directory and runs the real
# validator against them — no assertion library, no duplicated parsing logic,
# and no repository history is touched.
#
# Usage: scripts/test-validate-commit-messages.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-commit-messages.sh"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

passed=0
failed=0

# Each test runs in its own fresh repository so cases cannot leak into
# each other through shared history.
new_repo() {
	rm -rf "$WORKDIR/repo"
	mkdir -p "$WORKDIR/repo"
	cd "$WORKDIR/repo"
	git init -q .
	git config user.email "test@example.com"
	git config user.name "Test"
	git config commit.gpgsign false
	git config core.autocrlf false
	echo "base" > file.txt
	git add file.txt
	git commit -q -m "chore: base commit" -m "Establish a starting point for the validator tests to build on."
}

commit_with_message() {
	echo "$RANDOM-$1" >> file.txt
	git add file.txt
	git commit -q -F - <<< "$1"
}

expect() {
	local description="$1" expected_status="$2"
	local actual_status=0
	local output

	output="$(bash "$VALIDATOR" "$(git rev-parse HEAD~"$3")" HEAD 2>&1)" || actual_status=$?

	if [ "$actual_status" -eq "$expected_status" ]; then
		printf '  PASS  %s\n' "$description"
		passed=$((passed + 1))
	else
		printf '  FAIL  %s (expected exit %s, got %s)\n' "$description" "$expected_status" "$actual_status"
		printf '        %s\n' "$output"
		failed=$((failed + 1))
	fi
}

echo "Running validator tests..."

# --- cases that must PASS ---

new_repo
commit_with_message "feat(api): add tenant-scoped lookup

Add the lookup the admin dashboard needs and keep it tenant-scoped so the
existing authorization boundary is preserved."
expect "valid subject and descriptive body" 0 1

new_repo
commit_with_message "feat(api): add feature

Add the new API behavior required by the current workflow and keep the
operation tenant-scoped so existing authorization boundaries remain intact.

Co-Authored-By: Someone <email@example.com>"
expect "descriptive body plus Co-Authored-By trailer" 0 1

new_repo
commit_with_message "docs(ci): document the commit policy

Explain the required commit format so contributors do not have to open the
diff to understand a change.

Co-Authored-By: Someone <email@example.com>
Claude-Session: https://example.com/session"
expect "descriptive body plus multiple trailers" 0 1

new_repo
commit_with_message "feat(web): first change

Describe the first change in enough detail to be useful much later."
commit_with_message "fix(web): second change

Describe the second change in enough detail to be useful much later."
expect "multiple valid commits in one range" 0 2

# A generated merge commit has no hand-written body and must be ignored.
new_repo
git checkout -q -b side
commit_with_message "feat(api): side branch work

Add the side-branch behavior needed to exercise a real merge commit."
git checkout -q -
echo "main-side" >> other.txt
git add other.txt
git commit -q -m "chore: main branch work" -m "Add an unrelated change so the merge below is a genuine three-way merge."
git merge -q --no-ff side -m "Merge branch 'side'"
# HEAD~2 is the base commit along the first-parent chain (base -> main work ->
# merge). The range therefore contains both hand-written commits plus the merge
# commit, which --no-merges must drop.
expect "merge commit is ignored" 0 2

# --- cases that must FAIL ---

new_repo
commit_with_message "feat(api): subject only"
expect "subject only" 1 1

new_repo
commit_with_message "feat(api): add feature

Co-Authored-By: Someone <email@example.com>
Claude-Session: https://example.com/session"
expect "trailers only, no prose" 1 1

new_repo
commit_with_message "feat(api): add feature

Too short."
expect "descriptive body below the minimum length" 1 1

new_repo
printf 'feat(api): add feature\nBody starts immediately with no blank line separating it.\n' > "$WORKDIR/msg.txt"
echo "no-blank" >> file.txt
git add file.txt
git commit -q -F "$WORKDIR/msg.txt"
expect "no blank line between subject and body" 1 1

new_repo
commit_with_message "feat(web): good commit

Describe this change in enough detail that a future reader understands it."
commit_with_message "fix(web): bad commit

Co-Authored-By: Someone <email@example.com>"
expect "one bad commit among several fails the range" 1 2

# --- result ---

cd "$SCRIPT_DIR"
echo
echo "Passed: $passed   Failed: $failed"
[ "$failed" -eq 0 ] || exit 1
echo "All validator tests passed."
