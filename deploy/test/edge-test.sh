#!/usr/bin/env bash
# Edge test (direct mode): the real deploy/Caddyfile in front of a header-echo upstream.
# Proves: client-sent CF-Connecting-IP / X-Forwarded-For / X-Real-IP never reach the upstream, X-Real-IP is the real
# TCP peer, and two different clients are seen as two different IPs. Needs a Docker engine.
set -euo pipefail
cd "$(dirname "$0")"
FAILED=0
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; FAILED=1; }
trap 'docker compose -f docker-compose.edge-test.yml down -v >/dev/null 2>&1 || true' EXIT

docker compose -f docker-compose.edge-test.yml up -d >/dev/null
for _ in $(seq 1 30); do
  curl --resolve api.test.local:18443:127.0.0.1 -sk -o /dev/null -m 3 https://api.test.local:18443/ && break
  sleep 2
done

field() { python -c "import sys,json; h=json.load(sys.stdin)['headers']; print(h.get('$1','<absent>'))"; }
caddy_ip="$(docker inspect -f '{{(index .NetworkSettings.Networks "cbva-edge_internal").IPAddress}}' cbva-edge-caddy-1)"
client_ip="$(docker inspect -f '{{(index .NetworkSettings.Networks "cbva-edge_internal").IPAddress}}' cbva-edge-client-1)"
echo "caddy container=$caddy_ip  second client container=$client_ip"

echo "--- client 1 (docker host) sends spoofed CF-Connecting-IP, X-Forwarded-For and X-Real-IP"
body="$(curl --resolve api.test.local:18443:127.0.0.1 -sk https://api.test.local:18443/anything \
  -H 'CF-Connecting-IP: 1.1.1.1' -H 'X-Forwarded-For: 2.2.2.2, 3.3.3.3' -H 'X-Real-IP: 4.4.4.4')"
echo "$body" | python -c "import sys,json; h=json.load(sys.stdin)['headers']; print({k:h.get(k) for k in ('x-real-ip','cf-connecting-ip','x-forwarded-for')})"
real1="$(echo "$body" | field x-real-ip)"
[ "$(echo "$body" | field cf-connecting-ip)" = "<absent>" ] && pass "CF-Connecting-IP stripped" || fail "CF-Connecting-IP reached upstream"
[ "$(echo "$body" | field x-forwarded-for)" = "<absent>" ] && pass "X-Forwarded-For stripped" || fail "X-Forwarded-For reached upstream"
case "$real1" in 1.1.1.1|2.2.2.2|3.3.3.3|4.4.4.4|"<absent>"|"$caddy_ip") fail "X-Real-IP is spoofed/absent/caddy ($real1)";; *) pass "X-Real-IP is the real peer ($real1), not a spoofed value or Caddy ($caddy_ip)";; esac

echo "--- client 2 (another container) with the same spoofed headers"
body2="$(docker exec cbva-edge-client-1 curl -sk --connect-to api.test.local:443:cbva-edge-caddy-1:443 https://api.test.local/anything \
  -H 'CF-Connecting-IP: 1.1.1.1' -H 'X-Forwarded-For: 2.2.2.2' -H 'X-Real-IP: 4.4.4.4')"
real2="$(echo "$body2" | field x-real-ip)"
[ "$real2" = "$client_ip" ] && pass "second client seen as its own IP ($real2)" || fail "second client X-Real-IP=$real2, expected $client_ip"
[ "$real1" != "$real2" ] && pass "two real IPs are distinct ($real1 vs $real2)" || fail "buckets would collide"

echo "--- headers without any spoofing"
plain="$(curl --resolve api.test.local:18443:127.0.0.1 -sk https://api.test.local:18443/anything)"
[ "$(echo "$plain" | field x-real-ip)" = "$real1" ] && pass "X-Real-IP always set by Caddy" || fail "X-Real-IP missing when not spoofed"
[ "$(echo "$plain" | field x-forwarded-for)" = "<absent>" ] && pass "no X-Forwarded-For forwarded" || fail "X-Forwarded-For present"

echo "--- HTTP -> HTTPS redirect on port 80"
code="$(curl --resolve api.test.local:18080:127.0.0.1 -s -o /dev/null -w '%{http_code} %{redirect_url}' http://api.test.local:18080/health || true)"
case "$code" in 308*https://api.test.local*) pass "port 80 redirects to https ($code)";; *) fail "no redirect: $code";; esac

[ "$FAILED" = 0 ] && echo "EDGE TEST PASSED" || { echo "EDGE TEST FAILED"; exit 1; }
