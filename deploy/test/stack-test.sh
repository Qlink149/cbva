#!/usr/bin/env bash
# Full stack test, direct mode: the real deploy/docker-compose.yml + real deploy/Caddyfile + the real API image
# (build it first: SKIP_BUILD is not needed, run `docker build -t cbva-api:smoke backend`, or run smoke-test.sh once).
# Through Caddy it proves: health, TLS redirect, headers, real client IP reaches the API, spoofed X-Real-IP /
# CF-Connecting-IP / X-Forwarded-For cannot change the rate-limit bucket, and two real IPs get separate buckets.
set -euo pipefail
cd "$(dirname "$0")"
FAILED=0
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; FAILED=1; }
# expect <actual> <wanted> <pass message> <fail message>
expect() { if [ "$1" = "$2" ]; then pass "$3"; else fail "$4"; fi; }

SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
cat > .env.stack <<ENVF
ENV=prod
EDGE_MODE=direct
SECRET_KEY=$SECRET
DATABASE_NAME=cbva_stack
MONGODB_URL=mongodb://mongo:27017
FRONTEND_ORIGIN=https://app.test.local
ENVF
export TAG=test SITE_ADDRESS=api.test.local ACME_EMAIL=yogansh@claraai.tech
DC=(docker compose -p cbva-stack -f ../docker-compose.yml -f docker-compose.stack-test.yml --project-directory ..)
cleanup() { "${DC[@]}" down -v >/dev/null 2>&1 || true; rm -f .env.stack; }
trap cleanup EXIT

"${DC[@]}" up -d >/dev/null
for _ in $(seq 1 40); do
  curl --resolve api.test.local:18443:127.0.0.1 -sk -o /dev/null -m 3 https://api.test.local:18443/health/ready && break
  sleep 2
done
H=(--resolve api.test.local:18443:127.0.0.1 -sk -m 10)
net=cbva-stack_internal
caddy_ip="$(docker inspect -f "{{(index .NetworkSettings.Networks \"$net\").IPAddress}}" cbva-stack-caddy-1)"
client_ip="$(docker inspect -f "{{(index .NetworkSettings.Networks \"$net\").IPAddress}}" cbva-stack-client-1)"
echo "caddy=$caddy_ip  second client container=$client_ip"
inclient() { docker exec cbva-stack-client-1 curl -sk -m 10 --connect-to api.test.local:443:cbva-stack-caddy-1:443 "$@"; }

echo "--- health, redirect, headers"
expect "$(curl "${H[@]}" -o /dev/null -w '%{http_code}' https://api.test.local:18443/health/ready)" 200 "/health/ready 200 through Caddy" "/health/ready not 200"
hdrs="$(curl "${H[@]}" -D - -o /dev/null -H 'Origin: https://app.test.local' https://api.test.local:18443/health)"
hdrs_lc="$(printf '%s' "$hdrs" | tr '[:upper:]' '[:lower:]')"   # no early-closing reader (grep -q) in a pipe: no SIGPIPE
for want in 'strict-transport-security' 'x-content-type-options: nosniff' 'x-frame-options: deny' 'access-control-allow-origin: https://app.test.local'; do
  if [[ "$hdrs_lc" == *"$want"* ]]; then pass "header present: $want"; else fail "header missing: $want"; fi
done
expect "$(curl "${H[@]}" -o /dev/null -w '%{http_code}' https://api.test.local:18443/docs)" 404 "/docs disabled in prod" "/docs reachable"

echo "--- bootstrap, then log in as the admin from the second client container"
"${DC[@]}" run --rm --no-deps -e ADMIN_EMAIL=ops@example.com -e ADMIN_PASSWORD=correct-horse-battery api python -m app.cli bootstrap >/dev/null 2>&1 || true
login() { # login <email> <password> [extra curl args...]; prints the HTTP status
  local e="$1" p="$2"; shift 2
  curl "${H[@]}" -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$e\",\"password\":\"$p\"}" "$@" https://api.test.local:18443/api/auth/login
}
code="$(inclient -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"email":"ops@example.com","password":"correct-horse-battery"}' https://api.test.local/api/auth/login)"
expect "$code" 200 "bootstrapped admin can log in through Caddy" "admin login failed ($code)"

echo "--- spoofing: host sends 7 bad logins, each with DIFFERENT spoofed X-Real-IP / CF-Connecting-IP / X-Forwarded-For"
codes=""
for i in 1 2 3 4 5 6 7; do
  c="$(login "spray$i@x.com" bad -H "X-Real-IP: 9.9.9.$i" -H "CF-Connecting-IP: 8.8.8.$i" -H "X-Forwarded-For: 7.7.7.$i")"
  codes="$codes $c"
done
echo "status sequence:$codes"
expect "$(echo "$codes" | awk '{print $1$2$3$4$5}')" 401401401401401 "first 5 attempts -> 401" "unexpected first 5: $codes"
expect "$(echo "$codes" | awk '{print $6" "$7}')" "429 429" "6th and 7th -> 429: rotating spoofed headers did NOT escape the bucket" "spoofing evaded the limit: $codes"

echo "--- a different real IP (second container) is not locked out, and has its own bucket"
expect "$(inclient -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"email":"other@x.com","password":"bad"}' -H 'X-Real-IP: 9.9.9.1' https://api.test.local/api/auth/login)" 401 "second real IP gets 401, not 429" "second real IP was throttled"
c2=""
for i in 1 2 3 4 5 6; do c2="$c2 $(inclient -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "{\"email\":\"c$i@x.com\",\"password\":\"bad\"}" https://api.test.local/api/auth/login)"; done
echo "second client's own sequence:$c2"
case "$c2" in *429) pass "second client has its own 5/min bucket";; *) fail "second client never limited: $c2";; esac
expect "$(login "after@x.com" bad)" 429 "host bucket still exhausted (buckets are independent)" "host bucket reset unexpectedly"

echo "--- what the API logged as the client IP (never the Caddy container)"
ips="$("${DC[@]}" logs api --no-log-prefix 2>&1 | grep -o 'ip=[0-9.]*' | sort -u | tr '\n' ' ')"
echo "ips seen: $ips"
case "$ips" in *"ip=$caddy_ip"*) fail "API logged the Caddy container IP ($caddy_ip)";; *) pass "API never logged the Caddy container IP";; esac
case "$ips" in *ip=9.9.9.*|*ip=8.8.8.*|*ip=7.7.7.*) fail "a spoofed address appeared in the API log: $ips";; *) pass "no spoofed address in the API log";; esac
case "$ips" in *"ip=$client_ip"*) pass "second client's real IP ($client_ip) logged";; *) fail "second client IP missing from log";; esac

echo "--- resources"
docker stats --no-stream --format '{{.Name}}  mem={{.MemUsage}}  cpu={{.CPUPerc}}' cbva-stack-api-1 cbva-stack-caddy-1

if [ "$FAILED" = 0 ]; then echo "STACK TEST PASSED"; else echo "STACK TEST FAILED"; exit 1; fi
