#!/bin/bash
# P0-1 smoke test: the whole auth chain against a running server.
# Usage: bash scripts/smoke_auth.sh [base_url]   (default http://localhost:3000)
BASE="${1:-http://localhost:3000}"
JAR="$(mktemp)"
EMAIL="smoke-$(date +%s)@test.local"
NAME="Smoke Test"
PASS="smoke-pass-12345"
trap 'rm -f "$JAR"' EXIT

say() { printf '%s\n' "$*"; }
check() { # check <desc> <expected-substr> <actual>
  if printf '%s' "$3" | grep -q "$2"; then say "PASS $1"; else say "FAIL $1 — got: $(printf '%s' "$3" | head -c 160)"; exit 1; fi
}
totp() { # totp <base32secret> -> 6-digit code (tries t-1, t, t+1 via caller retries)
  python3 - "$1" "$2" <<'PY'
import base64, hmac, hashlib, struct, sys, time
secret = sys.argv[1].replace(" ", "").upper()
pad = "=" * (-len(secret) % 8)
key = base64.b32decode(secret + pad)
offset = int(sys.argv[2])
counter = int(time.time() // 30) + offset
msg = struct.pack(">Q", counter)
h = hmac.new(key, msg, hashlib.sha1).digest()
o = h[19] & 0x0F
code = (struct.pack(">B", h[o]) and int.from_bytes(h[o:o+4], "big") & 0x7FFFFFFF) % 1_000_000
print(f"{code:06d}")
PY
}

# 1. exists (new) -> false
R=$(curl -s -X POST "$BASE/api/auth/exists" -H 'content-type: application/json' -H 'x-am-csrf: 1' -d "{\"email\":\"$EMAIL\"}")
check "exists(new)=false" '"exists":false' "$R"

# 2. register (retry rolls until a free one is found)
OK=""
for i in 1 2 3 4 5; do
  ROLL=$(( (RANDOM + i * 37) % 100 + 1 ))
  R=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/register" -H 'content-type: application/json' -H 'x-am-csrf: 1' \
      -d "{\"email\":\"$EMAIL\",\"name\":\"$NAME\",\"rollNo\":$ROLL,\"password\":\"$PASS\"}")
  if printf '%s' "$R" | grep -q '"user"'; then OK=1; break; fi
done
[ -n "$OK" ] && check "register" '"user"' "$R" || { say "FAIL register — got: $R"; exit 1; }

# 3. me (cookie session)
R=$(curl -s -b "$JAR" "$BASE/api/auth/me")
check "me" '"email"' "$R"

# 4. security status
R=$(curl -s -b "$JAR" "$BASE/api/auth/security")
check "security" '"totpEnabled":false' "$R"

# 5. sessions list
R=$(curl -s -b "$JAR" "$BASE/api/auth/sessions")
check "sessions" '"sessions"' "$R"

# 6. 2fa setup -> secret from uri
R=$(curl -s -b "$JAR" -X POST "$BASE/api/auth/2fa/setup" -H 'x-am-csrf: 1')
check "2fa/setup" '"uri"' "$R"
SECRET=$(printf '%s' "$R" | grep -o 'secret=[A-Z2-7]*' | head -1 | cut -d= -f2)

# 7. 2fa enable with TOTP code (retry ±1 window for clock skew)
ENABLED=""
for off in 0 -1 1; do
  CODE=$(totp "$SECRET" "$off")
  R=$(curl -s -b "$JAR" -X POST "$BASE/api/auth/2fa/enable" -H 'content-type: application/json' -H 'x-am-csrf: 1' -d "{\"code\":\"$CODE\"}")
  if printf '%s' "$R" | grep -q '"backupCodes"'; then ENABLED=1; break; fi
done
[ -n "$ENABLED" ] && check "2fa/enable" '"backupCodes"' "$R" || { say "FAIL 2fa/enable — got: $R"; exit 1; }

# 8. regen backup codes (needs password + code)
CODE=$(totp "$SECRET" 0)
R=$(curl -s -b "$JAR" -X POST "$BASE/api/auth/2fa/backup" -H 'content-type: application/json' -H 'x-am-csrf: 1' -d "{\"password\":\"$PASS\",\"code\":\"$CODE\"}")
check "2fa/backup" '"backupCodes"' "$R"

# 9. change password (needs code now)
R=$(curl -s -b "$JAR" -X POST "$BASE/api/auth/change-password" -H 'content-type: application/json' -H 'x-am-csrf: 1' -d "{\"currentPassword\":\"$PASS\",\"newPassword\":\"$PASS-2\",\"code\":\"$CODE\"}")
check "change-password" '"ok":true' "$R"
PASS="$PASS-2"

# 10. logout
R=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/logout" -H 'x-am-csrf: 1')
check "logout" '"ok":true' "$R"

# 11. me after logout -> 401
R=$(curl -s -b "$JAR" "$BASE/api/auth/me")
check "me(after logout)=401" '"Not signed in"' "$R"

# 12. login -> twoFactorRequired
R=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -H 'x-am-csrf: 1' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
check "login(2fa required)" '"twoFactorRequired":true' "$R"

# 13. totp verify -> user
CODE=$(totp "$SECRET" 0)
R=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/totp" -H 'content-type: application/json' -H 'x-am-csrf: 1' -d "{\"code\":\"$CODE\"}")
check "totp verify" '"user"' "$R"

# 14. verify-password step-up
R=$(curl -s -b "$JAR" -X POST "$BASE/api/auth/verify-password" -H 'content-type: application/json' -H 'x-am-csrf: 1' -d "{\"stepUp\":{\"password\":\"$PASS\",\"code\":\"$CODE\"}}")
check "verify-password" '"ok":true' "$R"

# 15. reset-request (no email configured -> still a calm 200 or a mapped 4xx/5xx)
R=$(curl -s -X POST "$BASE/api/auth/reset-request" -H 'content-type: application/json' -H 'x-am-csrf: 1' -d "{\"email\":\"$EMAIL\"}")
check "reset-request(responds)" '' "$R"
say "     reset-request body: $(printf '%s' "$R" | head -c 120)"

# 16. logout final
curl -s -b "$JAR" -X POST "$BASE/api/auth/logout" -H 'x-am-csrf: 1' > /dev/null
say "SMOKE OK — full chain passed against $BASE"
