#!/usr/bin/env bash
# Pre-commit gate for the maze: a commit that touches maze/ has to have a passing
# first-person suite (tools/fp-smoke.mjs) behind it. It was the top-down's smoke.mjs until
# Joe: "update your checks and processes to no longer look at the top down map in the loop.
# That is not a concern of ours anymore."
#
# Why this exists: "Smoke 55" went into a commit message once on the strength of a
# run that had actually errored out because the static server had stopped. A run
# that errors looks nothing like a run that fails, and neither looks like a pass
# if you only read the last two lines. This reads the verdict, not the tail.
#
# It also runs tools/docs-check.mjs on the green path and passes on what it says.
# That one is advice, never a block: staleness is a judgement, not a failure.
#
# It never blocks on its own failure to run — if node is missing it says so and
# lets the commit through, because a gate that misfires gets switched off.

set -uo pipefail
payload=$(cat)

# Only git commit, and only when the commit actually touches the maze.
case "$(printf '%s' "$payload" | tr '\n' ' ')" in
  *'git commit'*) ;;
  *) exit 0 ;;
esac
git diff --cached --name-only 2>/dev/null | grep -q '^maze/' || exit 0

say() { printf '%s\n' "$1"; }
skip() {   # let it through, but say why out loud
  say "{\"systemMessage\": $(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/')}"
  exit 0
}
block() {
  say "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"deny\", \"permissionDecisionReason\": $(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/')}}"
  exit 0
}

command -v node >/dev/null 2>&1 || skip "maze gate skipped: no node on PATH."
[ -f maze/tools/fp-smoke.mjs ] || skip "maze gate skipped: maze/tools/fp-smoke.mjs not found from $(pwd)."

# fp-smoke starts a static server on 8765 itself if none is answering
out=$(node maze/tools/fp-smoke.mjs 2>&1)
code=$?

# The verdict first, the exit code only as a fallback: a red suite exits 1 *and* prints
# a verdict, and reporting that as "it did not run" sends you looking for the wrong thing.
verdict=$(printf '%s\n' "$out" | grep -E '^(PASS|FAIL) —' | tail -1)
case "$verdict" in
  PASS*)
    # Advisory only, and only on the green path: whether the docs have been read
    # lately is worth saying and never worth blocking a commit over. Newlines are
    # collapsed because the JSON string below is built with sed, not a real encoder.
    if [ -f maze/tools/docs-check.mjs ]; then
      docs=$(node maze/tools/docs-check.mjs --brief 2>/dev/null | tr '\n' ' ')
      case "$docs" in
        *[![:space:]]*) skip "fp-smoke is green. $docs" ;;
      esac
    fi
    exit 0
    ;;
  FAIL*) block "fp-smoke is red, so the commit is blocked. $verdict" ;;
esac
block "fp-smoke never reached a verdict (exit $code), so this commit is not verified — this is what an errored run looks like, not a failing one. Last lines: $(printf '%s' "$out" | tail -3 | tr '\n' ' ')"
