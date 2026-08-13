#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BROWSER="${CHROME_BIN:-}"
if [[ -z "$BROWSER" ]]; then
  for c in chromium google-chrome chrome chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then BROWSER="$(command -v "$c")"; break; fi
  done
fi
if [[ -z "$BROWSER" ]]; then
  echo "orc-castle-smoke: SKIP (Chromium/Chrome not found)"
  [[ "${CI:-}" == "true" ]] && exit 1 || exit 0
fi
run_case(){
  local mode="$1"
  local tmp port pid
  tmp="$(mktemp -d)"
  port="$(python3 - <<'PY'
import socket
s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()
PY
)"
  "$BROWSER" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --remote-allow-origins='*' --remote-debugging-port="$port" \
    --user-data-dir="$tmp/chrome-profile" about:blank >"$tmp/chromium.out" 2>"$tmp/chromium.err" &
  pid=$!
  cleanup_case(){ kill "$pid" >/dev/null 2>&1 || true; wait "$pid" >/dev/null 2>&1 || true; sleep 0.1; rm -rf "$tmp" >/dev/null 2>&1 || true; }
  trap cleanup_case RETURN
  node "$ROOT/tests/orc-castle-smoke.mjs" "$port" "$ROOT" "$mode"
  cleanup_case
  trap - RETURN
}
run_case before
run_case after
echo "orc-castle-smoke: PASS ($BROWSER)"
