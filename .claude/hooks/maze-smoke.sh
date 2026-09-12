#!/usr/bin/env bash
# Pre-commit gate for the maze: a commit that touches maze/ has to have a passing
# smoke suite behind it.
#
# Why this exists: "Smoke 55" went into a commit message once on the strength of a
# run that had actually errored out because the static server had stopped. A run
# that errors looks nothing like a run that fails, and neither looks like a pass
# if you only read the last two lines. This reads the verdict, not the tail.
#
# It also runs tools/docs-check.mjs on the green path and passes on what it says.
# That one is advice, never a block: staleness is a judgement, not a failure.
#
# It never blocks on its own failure to run — if node or python is missing it says
# so and lets the commit through, because a gate that misfires gets switched off.

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

command -v node >/dev/null 2>&1 || skip "maze smoke gate skipped: no node on PATH."
PY=$(command -v python3 || command -v python) || PY=""
[ -f maze/tools/smoke.mjs ] || skip "maze smoke gate skipped: maze/tools/smoke.mjs not found from $(pwd)."

URL=http://127.0.0.1:8765/maze/maze-topdown.html
started=""
if ! curl -sf -o /dev/null --max-time 3 "$URL" 2>/dev/null; then
  [ -n "$PY" ] || skip "maze smoke gate skipped: the static server is not up and no python to start one."
  nohup "$PY" -m http.server 8765 >/dev/null 2>&1 &
  started=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -sf -o /dev/null --max-time 2 "$URL" 2>/dev/null && break
    sleep 0.5
  done
fi

out=$(node maze/tools/smoke.mjs 2>&1)
code=$?
[ -n "$started" ] && kill "$started" 2>/dev/null

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
        *[![:space:]]*) skip "Smoke is green (55). $docs" ;;
      esac
    fi
    exit 0
    ;;
  FAIL*) block "Smoke is red, so the commit is blocked. $verdict" ;;
esac
block "The smoke suite never reached a verdict (exit $code), so this commit is not verified — this is what an errored run looks like, not a failing one. Last lines: $(printf '%s' "$out" | tail -3 | tr '\n' ' ')"
