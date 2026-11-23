#!/usr/bin/env bash
# AttendMate Pro — production check harness ("the harness loop").
# Runs every quality gate in order and stops at the first failure:
#   lint → typecheck → unit tests → build → boot prod server → smoke tests
# Usage: bash scripts/check.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
step() { echo; echo "==> $1"; }
ok()   { echo "    ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "    ✗ $1"; FAIL=$((FAIL+1)); }

step "1/6  lint"
bun run lint && ok "eslint clean" || bad "eslint failed"

step "2/6  typecheck"
bunx tsc --noEmit && ok "tsc clean" || bad "type errors"

step "3/6  unit tests"
bun test tests/ && ok "unit tests green" || bad "unit tests failed"

step "4/6  production build"
bun run build && ok "build succeeded" || bad "build failed"

step "5/6  boot production server"
pkill -f "standalone/server.js" 2>/dev/null || true; sleep 1
(bun run start > /tmp/am-check-server.log 2>&1 &)
for i in $(seq 1 20); do
  curl -sf -o /dev/null http://localhost:3000/api/health && break
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/api/health && ok "server is up" || bad "server did not come up (see /tmp/am-check-server.log)"

step "6/6  smoke tests"
# health payload
curl -s http://localhost:3000/api/health | grep -q '"ok":true' \
  && ok "health ok:true" || bad "health payload wrong"
# security headers present on HTML responses
H=$(curl -sI http://localhost:3000/)
echo "$H" | grep -qi "x-frame-options: DENY" && ok "X-Frame-Options DENY" || bad "missing X-Frame-Options"
echo "$H" | grep -qi "x-content-type-options: nosniff" && ok "nosniff" || bad "missing nosniff"
echo "$H" | grep -qi "referrer-policy: strict-origin-when-cross-origin" && ok "Referrer-Policy" || bad "missing Referrer-Policy"
echo "$H" | grep -qiv "x-powered-by" && ok "X-Powered-By hidden" || bad "X-Powered-By exposed"
# PWA assets
curl -sf -o /dev/null http://localhost:3000/manifest.webmanifest && ok "manifest served" || bad "manifest missing"
curl -sf -o /dev/null http://localhost:3000/sw.js && ok "service worker served" || bad "sw.js missing"
# unique-roll enforcement: taken roll must be rejected at register
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "content-type: application/json" -H "x-am-csrf: 1" \
  -d '{"email":"harness-probe@example.com","name":"Harness Probe","rollNo":35,"password":"probe12345"}' \
  | grep -q "already registered" \
  && ok "duplicate roll rejected (uniqueness enforced)" || bad "duplicate roll was accepted!"
# availability endpoint shape
curl -s "http://localhost:3000/api/auth/roll?roll=77" | grep -q '"taken":false' \
  && ok "roll availability endpoint works" || bad "roll endpoint broken"

echo
echo "==================================="
if [ "$FAIL" -eq 0 ]; then echo "ALL CHECKS PASSED ($PASS checks)"; else echo "FAILED: $FAIL check(s) ($PASS passed)"; exit 1; fi
