#!/usr/bin/env bash
# Commit and push local changes to origin (current branch).
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT"

if [[ -f .cursor/sync.env ]]; then
  # shellcheck disable=SC1091
  set -a && source .cursor/sync.env && set +a
fi

[[ "${AUTO_PUSH:-1}" == "1" ]] || exit 0

BRANCH=$(git branch --show-current)
if [[ -z "$BRANCH" ]]; then
  exit 0
fi

if [[ "$BRANCH" == "main" && "${ALLOW_MAIN_SYNC:-0}" != "1" ]]; then
  exit 0
fi

LOCK=".cursor/.sync.lock"
if [[ -f "$LOCK" ]]; then
  pid=$(cat "$LOCK" 2>/dev/null || true)
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    exit 0
  fi
fi
echo $$ >"$LOCK"
trap 'rm -f "$LOCK"' EXIT

export GIT_TERMINAL_PROMPT=0

git add -A

if git diff --cached --quiet; then
  git push origin "$BRANCH" 2>/dev/null || true
  exit 0
fi

timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
git commit -m "sync: Cursor auto-save ${timestamp}"
git push origin "$BRANCH"
