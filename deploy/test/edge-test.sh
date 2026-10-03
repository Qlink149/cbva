#!/usr/bin/env bash
# Edge test (direct mode): the real deploy/Caddyfile in front of a header-echo upstream.
# Proves: client-sent CF-Connecting-IP / X-Forwarded-For / X-Real-IP never reach the upstream, X-Real-IP is the real
# TCP peer, and two different clients are seen as two different IPs. Needs a Docker engine.
set -euo pipefail
cd "$(dirname "$0")"
FAILED=0
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; FAILED=1; }
# expect <actual> <wanted> <pass message> <fail message>
expect() { if [ "$1" = "$2" ]; then pass "$3"; else fail "$4"; fi; }
trap 'docker compose -f docker-compose.edge-test.yml down -v >/dev/null 2>&1 || true' EXIT

docker compose -f docker-compose.edge-test.yml up -d >/dev/null
for _ in $(seq 1 30); do
  curl --resolve api.test.local:18443:127.0.0.1 -sk -o /dev/null -m 3 https://api.test.local:18443/ && break
  sleep 2
done

PY="$(command -v python || command -v python3)"
field() { "$PY" -c "import sys,json; h=json.load(sys.stdin)['headers']; print(h.get('$1','<absent>'))"; }
caddy_ip="$(docker inspect -f '{{(index .NetworkSettings.Networks "cbva-edge_internal").IPAddress}}' cbva-edge-caddy-1)"
client_ip="$(docker inspect -f '{{(index .NetworkSettings.Networks "cbva-edge_internal").IPAddress}}' cbva-edge-client-1)"
echo "caddy container=$caddy_ip  second client container=$client_ip"

echo "--- client 1 (docker host) sends spoofed CF-Connecting-IP, X-Forwarded-For, X-Real-IP and X-Forwarded-Proto"
body="$(curl --resolve api.test.local:18443:127.0.0.1 -sk https://api.test.local:18443/anything \
  -H 'CF-Connecting-IP: 1.1.1.1' -H 'X-Forwarded-For: 2.2.2.2, 3.3.3.3' -H 'X-Real-IP: 4.4.4.4' -H 'X-Forwarded-Proto: http')"
echo "$body" | "$PY" -c "import sys,json; h=json.load(sys.stdin)['headers']; print({k:h.get(k) for k in ('x-real-ip','cf-connecting-ip','x-forwarded-for','x-forwarded-proto')})"
expect "$(echo "$body" | field x-forwarded-proto)" "https" "X-Forwarded-Proto set by Caddy to https (client-sent 'http' overwritten)" "X-Forwarded-Proto not https"
real1="$(echo "$body" | field x-real-ip)"
expect "$(echo "$body" | field cf-connecting-ip)" "<absent>" "CF-Connecting-IP stripped" "CF-Connecting-IP reached upstream"
expect "$(echo "$body" | field x-forwarded-for)" "<absent>" "X-Forwarded-For stripped" "X-Forwarded-For reached upstream"
case "$real1" in 1.1.1.1|2.2.2.2|3.3.3.3|4.4.4.4|"<absent>"|"$caddy_ip") fail "X-Real-IP is spoofed/absent/caddy ($real1)";; *) pass "X-Real-IP is the real peer ($real1), not a spoofed value or Caddy ($caddy_ip)";; esac

echo "--- client 2 (another container) with the same spoofed headers"
body2="$(docker exec cbva-edge-client-1 curl -sk --connect-to api.test.local:443:cbva-edge-caddy-1:443 https://api.test.local/anything \
  -H 'CF-Connecting-IP: 1.1.1.1' -H 'X-Forwarded-For: 2.2.2.2' -H 'X-Real-IP: 4.4.4.4')"
real2="$(echo "$body2" | field x-real-ip)"
expect "$real2" "$client_ip" "second client seen as its own IP ($real2)" "second client X-Real-IP=$real2, expected $client_ip"
if [ "$real1" != "$real2" ]; then pass "two real IPs are distinct ($real1 vs $real2)"; else fail "buckets would collide"; fi

echo "--- headers without any spoofing"
plain="$(curl --resolve api.test.local:18443:127.0.0.1 -sk https://api.test.local:18443/anything)"
expect "$(echo "$plain" | field x-real-ip)" "$real1" "X-Real-IP always set by Caddy" "X-Real-IP missing when not spoofed"
expect "$(echo "$plain" | field x-forwarded-for)" "<absent>" "no X-Forwarded-For forwarded" "X-Forwarded-For present"

echo "--- HTTP -> HTTPS redirect on port 80"
code="$(curl --resolve api.test.local:18080:127.0.0.1 -s -o /dev/null -w '%{http_code} %{redirect_url}' http://api.test.local:18080/health || true)"
case "$code" in 308*https://api.test.local*) pass "port 80 redirects to https ($code)";; *) fail "no redirect: $code";; esac

if [ "$FAILED" = 0 ]; then echo "EDGE TEST PASSED"; else echo "EDGE TEST FAILED"; exit 1; fi
