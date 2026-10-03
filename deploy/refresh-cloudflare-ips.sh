#!/usr/bin/env bash
# Syncs Cloudflare's published edge ranges into (1) ufw rules for 80/443 and (2) Caddy's trusted_proxies.
# One source of truth, so the firewall and Caddy can never disagree. Run as root; idempotent; safe to cron.
#   refresh-cloudflare-ips.sh                 # apply
#   DRY_RUN=1 refresh-cloudflare-ips.sh       # only print what would change
#   refresh-cloudflare-ips.sh --remove        # leave cloudflare mode: delete the ufw rules and the DOCKER-USER chain
# Only used with EDGE_MODE=cloudflare. Besides ufw it re-applies the DOCKER-USER rules (the ones that actually
# restrict Docker-published ports) and regenerates Caddy's trusted_proxies snippet.
set -euo pipefail

CF_V4_URL="https://www.cloudflare.com/ips-v4"
CF_V6_URL="https://www.cloudflare.com/ips-v6"
STATE_DIR="${STATE_DIR:-/var/lib/cbva}"
CADDY_CONF="${CADDY_CONF:-/opt/cbva/cloudflare-ips.conf}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/cbva}"
DRY_RUN="${DRY_RUN:-0}"

if [ "${1:-}" = "--remove" ]; then
  old="$STATE_DIR/cloudflare-ips.list"
  if [ -f "$old" ]; then
    while IFS= read -r c; do [ -n "$c" ] && { ufw delete allow proto tcp from "$c" to any port 80,443 comment 'cloudflare-web' >/dev/null 2>&1 || true; }; done < "$old"
    rm -f "$old"
  fi
  if [ -x /usr/local/sbin/cbva-docker-firewall ]; then /usr/local/sbin/cbva-docker-firewall --remove || true; fi
  rm -f /etc/cron.d/cbva-cloudflare-ips
  echo "cloudflare mode removed (ufw rules, DOCKER-USER chain, cron)"
  exit 0
fi
CIDR_RE='^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$|^[0-9a-fA-F:]+/[0-9]{1,3}$'

fetch() { curl -fsS --max-time 20 --retry 3 "$1" | tr -d '\r' | sed '/^$/d'; }
v4="$(fetch "$CF_V4_URL")"; v6="$(fetch "$CF_V6_URL")"
all="$(printf '%s\n%s\n' "$v4" "$v6" | sort -u)"

# Refuse to act on anything that is not a plain list of CIDRs (e.g. an HTML error page) or is suspiciously short.
while IFS= read -r c; do [[ "$c" =~ $CIDR_RE ]] || { echo "refusing: unexpected line '$c'" >&2; exit 1; }; done <<<"$all"
[ "$(printf '%s\n' "$all" | wc -l)" -ge 10 ] || { echo "refusing: fewer than 10 ranges returned" >&2; exit 1; }

mkdir -p "$STATE_DIR"
old_list="$STATE_DIR/cloudflare-ips.list"; touch "$old_list"
new_list="$(mktemp)"; printf '%s\n' "$all" > "$new_list"

added="$(comm -13 <(sort "$old_list") <(sort "$new_list"))"
removed="$(comm -23 <(sort "$old_list") <(sort "$new_list"))"
echo "ranges: $(wc -l < "$new_list") total, +$(printf '%s' "$added" | grep -c . || true) -$(printf '%s' "$removed" | grep -c . || true)"

if [ "$DRY_RUN" = 1 ]; then echo "DRY_RUN: no changes applied"; rm -f "$new_list"; exit 0; fi

# Add before removing so there is never a window without access.
while IFS= read -r c; do [ -n "$c" ] && ufw allow proto tcp from "$c" to any port 80,443 comment 'cloudflare-web' >/dev/null; done <<<"$added"
while IFS= read -r c; do [ -n "$c" ] && { ufw delete allow proto tcp from "$c" to any port 80,443 comment 'cloudflare-web' >/dev/null || true; }; done <<<"$removed"
# Remove any blanket 80/443 allow (bootstrap used to open them to the world).
for p in 80 443; do ufw delete allow "$p/tcp" >/dev/null 2>&1 || true; done

mv "$new_list" "$old_list"

# The rules that really restrict Docker-published ports (ufw does not see them).
if [ -x /usr/local/sbin/cbva-docker-firewall ]; then
  EDGE_MODE=cloudflare STATE_DIR="$STATE_DIR" /usr/local/sbin/cbva-docker-firewall
fi

# Caddy snippet: imported by the Caddyfile's global `servers` block.
tmp_conf="$(mktemp)"
printf 'trusted_proxies static %s\n' "$(tr '\n' ' ' < "$old_list" | sed 's/ $//')" > "$tmp_conf"
if ! cmp -s "$tmp_conf" "$CADDY_CONF" 2>/dev/null; then
  install -m 644 "$tmp_conf" "$CADDY_CONF"
  if [ -f "$COMPOSE_DIR/docker-compose.yml" ] && docker compose -f "$COMPOSE_DIR/docker-compose.yml" ps -q caddy 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_DIR/docker-compose.yml" -f "$COMPOSE_DIR/docker-compose.cloudflare.yml" exec -T caddy caddy reload --config /etc/caddy/Caddyfile
  fi
fi
rm -f "$tmp_conf"
echo "ufw, DOCKER-USER and $CADDY_CONF updated"
