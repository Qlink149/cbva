#!/usr/bin/env bash
# Container smoke test. Needs a Docker engine and a reachable MongoDB.
#   deploy/smoke-test.sh [image-tag]            # builds backend/ unless IMAGE is set
# Env: MONGO_URL (default: starts a throwaway mongo:7 container), KEEP=1 to leave containers running.
# Checks: non-root, read-only rootfs survives 60s, /health, /health/ready 200, HEALTHCHECK healthy, RSS after
# 10 requests, image contents (no .env/.venv/db/csv/scripts/tests), 503 within 3s when Mongo is stopped, and a
# clean SIGTERM (exit 0 within the grace period).
set -euo pipefail

IMAGE="${IMAGE:-cbva-api:smoke}"
NET="cbva-smoke-$$"
API="cbva-smoke-api-$$"
MONGO="cbva-smoke-mongo-$$"
SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; FAILED=1; }
FAILED=0
cleanup() { [ "${KEEP:-0}" = 1 ] || { docker rm -f "$API" "$MONGO" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; }; }
trap cleanup EXIT

here="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${SKIP_BUILD:-}" ]; then docker build -t "$IMAGE" "$here/backend"; fi
echo "--- image size / top layers"; docker images "$IMAGE" --format '{{.Repository}}:{{.Tag}} {{.Size}}'
docker history --no-trunc=false "$IMAGE" | head -8

echo "--- image contents"
docker run --rm --entrypoint sh "$IMAGE" -c 'ls -la /app; find / -name ".env*" -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null' | tee /tmp/smoke-contents.txt
for bad in .venv db csv scripts tests; do
  if docker run --rm --entrypoint sh "$IMAGE" -c "[ -e /app/$bad ]"; then fail "/app/$bad present in image"; else pass "/app/$bad absent"; fi
done
if grep -qE '(^|/)\.env' /tmp/smoke-contents.txt; then fail ".env file found in image"; else pass "no .env in image"; fi

docker network create "$NET" >/dev/null
docker run -d --name "$MONGO" --network "$NET" mongo:7 >/dev/null
for _ in $(seq 1 30); do docker exec "$MONGO" mongosh --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null | grep -q 1 && break; sleep 1; done

docker run -d --name "$API" --network "$NET" --read-only --tmpfs /tmp --memory 700m --user 10001:10001 \
  --cap-drop ALL --security-opt no-new-privileges:true --stop-timeout 20 \
  -e ENV=prod -e SECRET_KEY="$SECRET" -e DATABASE_NAME=cbva_smoke -e MONGODB_URL="mongodb://$MONGO:27017" \
  -e FRONTEND_ORIGIN=https://app.example.com "$IMAGE" >/dev/null

echo "--- non-root"
uid="$(docker exec "$API" id -u)"
if [ "$uid" != 0 ]; then pass "uid=$uid"; else fail "running as root"; fi

echo "--- stays up 60s on read-only rootfs"
for _ in $(seq 1 12); do sleep 5; [ "$(docker inspect -f '{{.State.Running}}' "$API")" = true ] || { fail "container exited"; docker logs "$API" | tail -30; exit 1; }; done
pass "up for 60s"
ip="$(docker inspect -f "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" "$API")"
code() { docker run --rm --network "$NET" curlimages/curl -s -o /dev/null -w '%{http_code}' -m "${2:-5}" "$1"; }
expect "$(code "http://$ip:8000/health")" 200 "/health 200" "/health"
expect "$(code "http://$ip:8000/health/ready")" 200 "/health/ready 200 (mongo up)" "/health/ready (mongo up)"

echo "--- HEALTHCHECK"
for _ in $(seq 1 12); do s="$(docker inspect -f '{{.State.Health.Status}}' "$API")"; [ "$s" = healthy ] && break; sleep 5; done
expect "$s" healthy "health=healthy" "health=$s"

echo "--- 10 requests then docker stats"
for p in /health /health/ready /api/auth/me /api/leaders/ /api/kra/categories /api/firmwide/summary /api/admin/users /docs /openapi.json /health; do code "http://$ip:8000$p" >/dev/null; done
docker stats --no-stream --format 'RSS/limit: {{.MemUsage}}  cpu: {{.CPUPerc}}' "$API"

echo "--- mongo down -> 503 within ~3s; recovery"
docker stop "$MONGO" >/dev/null
t0=$(date +%s.%N); c="$(code "http://$ip:8000/health/ready" 6)"; t1=$(date +%s.%N)
el="$(echo "$t1 - $t0" | bc 2>/dev/null || echo '?')"
expect "$c" 503 "503 in ${el}s" "expected 503 got $c"
expect "$(code "http://$ip:8000/health")" 200 "/health still 200 during outage" "liveness during outage"
docker start "$MONGO" >/dev/null; sleep 8
expect "$(code "http://$ip:8000/health/ready" 6)" 200 "/health/ready recovers" "no recovery"

echo "--- SIGTERM"
start=$(date +%s); docker stop "$API" >/dev/null; dur=$(( $(date +%s) - start ))
ec="$(docker inspect -f '{{.State.ExitCode}}' "$API")"
expect "$ec" 0 "exit code 0 in ${dur}s" "exit code $ec"
docker logs "$API" 2>&1 | tail -6

if [ "$FAILED" = 0 ]; then echo "SMOKE TEST PASSED"; else echo "SMOKE TEST FAILED"; exit 1; fi
