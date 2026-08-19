#!/usr/bin/env bash
#
# Validates that every non-merge commit in a range carries a descriptive body,
# not just a subject line and generated trailers.
#
# Usage:
#   scripts/validate-commit-messages.sh <base-sha> <head-sha>
#
# Exits 0 when every commit passes, 1 when any commit fails, 2 on misuse.
#
# Dependency-free by design: Git and POSIX-ish shell tooling only, so it runs
# identically on a GitHub Ubuntu runner and on a developer machine. See
# docs/DEVELOPMENT_WORKFLOW.md for the policy this enforces.

set -euo pipefail

# Minimum non-whitespace characters across all descriptive body lines. Low
# enough that one honest sentence passes, high enough that "wip" or "see PR"
# does not. This is deliberately a length floor, not a writing-quality judgement.
MIN_DESCRIPTIVE_CHARS=20

usage() {
	cat >&2 <<'USAGE'
Usage: scripts/validate-commit-messages.sh <base-sha> <head-sha>

Validates every non-merge commit in <base-sha>..<head-sha>.

Each commit must have:
  1. a non-empty subject line;
  2. a blank line after the subject;
  3. at least one descriptive (non-trailer) body line;
  4. at least 20 non-whitespace characters of description in total.
USAGE
}

if [ "$#" -ne 2 ]; then
	usage
	exit 2
fi

BASE_SHA="$1"
HEAD_SHA="$2"

# Git trailer keys that carry metadata rather than description. A key is
# treated as a trailer when it is a single token followed by a colon AND it is
# either one of these known keys or contains a hyphen (which every conventional
# trailer key does: Co-Authored-By, Signed-off-by, Claude-Session, Change-Id...).
#
# The hyphen rule is the deliberate simplification that keeps this from needing
# a full RFC parser: it means an ordinary prose line such as "Note: the review
# form stays dirty" still counts as description, because "Note" has no hyphen
# and is not a known key.
KNOWN_TRAILER_KEYS="co-authored-by signed-off-by reviewed-by tested-by acked-by reported-by suggested-by claude-session change-id cc fixes closes refs"

is_trailer_line() {
	local line="$1"
	local key lower

	# Must look like "Token: value" with no whitespace inside the token.
	if ! printf '%s' "$line" | grep -Eq '^[A-Za-z][A-Za-z0-9-]*:'; then
		return 1
	fi

	key="${line%%:*}"
	lower="$(printf '%s' "$key" | tr '[:upper:]' '[:lower:]')"

	case " $KNOWN_TRAILER_KEYS " in
		*" $lower "*) return 0 ;;
	esac

	# Any hyphenated single-token key is treated as a trailer too.
	case "$key" in
		*-*) return 0 ;;
	esac

	return 1
}

# Emitted per failing commit so the author can see exactly what to fix.
fail_commit() {
	local sha="$1" subject="$2" reason="$3"
	printf '  %s  %s\n' "$(git rev-parse --short "$sha")" "$subject" >&2
	printf '      -> %s\n' "$reason" >&2
}

commits="$(git rev-list --no-merges --reverse "$BASE_SHA..$HEAD_SHA")"

if [ -z "$commits" ]; then
	echo "No non-merge commits in ${BASE_SHA}..${HEAD_SHA} — nothing to validate."
	exit 0
fi

total=0
failed=0

while IFS= read -r sha; do
	[ -n "$sha" ] || continue
	total=$((total + 1))

	# mapfile keeps blank lines, which matters: the blank separator after the
	# subject is part of what is being validated.
	mapfile -t lines < <(git log -1 --format=%B "$sha")

	subject="${lines[0]:-}"
	reason=""

	if [ -z "$(printf '%s' "$subject" | tr -d '[:space:]')" ]; then
		reason="missing subject"
	elif [ "${#lines[@]}" -lt 2 ]; then
		reason="missing descriptive body (subject only)"
	elif [ -n "$(printf '%s' "${lines[1]}" | tr -d '[:space:]')" ]; then
		reason="missing blank separator between subject and body"
	else
		descriptive=""
		index=2
		while [ "$index" -lt "${#lines[@]}" ]; do
			line="${lines[$index]}"
			index=$((index + 1))

			[ -n "$(printf '%s' "$line" | tr -d '[:space:]')" ] || continue
			is_trailer_line "$line" && continue

			descriptive="${descriptive}${line} "
		done

		descriptive_chars="$(printf '%s' "$descriptive" | tr -d '[:space:]' | wc -c | tr -d '[:space:]')"

		if [ "$descriptive_chars" -eq 0 ]; then
			reason="missing descriptive body (only trailers found)"
		elif [ "$descriptive_chars" -lt "$MIN_DESCRIPTIVE_CHARS" ]; then
			reason="descriptive body too short (${descriptive_chars} characters, minimum ${MIN_DESCRIPTIVE_CHARS})"
		fi
	fi

	if [ -n "$reason" ]; then
		if [ "$failed" -eq 0 ]; then
			echo "Commit message validation failed:" >&2
		fi
		failed=$((failed + 1))
		fail_commit "$sha" "$subject" "$reason"
	fi
done <<< "$commits"

if [ "$failed" -gt 0 ]; then
	{
		echo
		echo "${failed} of ${total} commit(s) need a descriptive body."
		echo "Every non-merge commit needs a subject, a blank line, and prose explaining"
		echo "what changed and why. Trailers such as Co-Authored-By or Claude-Session do"
		echo "not count. See docs/DEVELOPMENT_WORKFLOW.md for the format and examples."
	} >&2
	exit 1
fi

echo "All ${total} non-merge commit(s) have a descriptive body."
