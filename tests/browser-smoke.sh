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
  echo "browser-smoke: SKIP (Chromium/Chrome not found)"
  [[ "${CI:-}" == "true" ]] && exit 1 || exit 0
fi
TMP="$(mktemp -d)"; BROWSER_PID=""
cleanup(){ [[ -n "$BROWSER_PID" ]] && kill "$BROWSER_PID" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
DEBUG_PORT="$(python3 - <<'PY'
import socket
s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()
PY
)"
"$BROWSER" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-allow-origins='*' --remote-debugging-port="$DEBUG_PORT" \
  --user-data-dir="$TMP/chrome-profile" about:blank >"$TMP/chromium.out" 2>"$TMP/chromium.err" &
BROWSER_PID=$!
node "$ROOT/tests/cdp-smoke.mjs" "$DEBUG_PORT" "$ROOT"
echo "browser-smoke: PASS ($BROWSER)"
