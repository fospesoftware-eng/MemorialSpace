#!/usr/bin/env bash
# Debounced sync trigger for afterFileEdit (reads hook JSON from stdin).
set -euo pipefail

cat >/dev/null

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT"

if [[ -f .cursor/sync.env ]]; then
  # shellcheck disable=SC1091
  set -a && source .cursor/sync.env && set +a
fi

DEBOUNCE="${DEBOUNCE_SEC:-20}"
PIDFILE=".cursor/.sync-schedule.pid"
mkdir -p .cursor

if [[ -f "$PIDFILE" ]]; then
  old=$(cat "$PIDFILE" 2>/dev/null || true)
  if [[ -n "$old" ]]; then
    kill "$old" 2>/dev/null || true
  fi
fi

(
  sleep "$DEBOUNCE"
  exec "$ROOT/.cursor/hooks/sync-to-github.sh"
) &

echo $! >"$PIDFILE"
exit 0
