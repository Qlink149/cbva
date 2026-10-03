#!/usr/bin/env bash
# Controls who may reach Docker-PUBLISHED ports (Caddy's 80/443). ufw alone does not: Docker publishes ports through
# NAT and the FORWARD chain, which ufw's INPUT rules never see. DOCKER-USER is evaluated first for that traffic.
#
#   EDGE_MODE=direct      (default) 80/443 from anywhere (80 is needed for ACME HTTP-01 and the HTTPS redirect)
#   EDGE_MODE=cloudflare  80/443 only from Cloudflare's IPv4 ranges (read from /var/lib/cbva/cloudflare-ips.list,
#                         written by refresh-cloudflare-ips.sh)
#   In both modes any OTHER new connection arriving from outside into a container is dropped, so a port that is
#   published by mistake (e.g. 8000:8000) is still unreachable from the internet.
#
#   docker-user-firewall.sh            apply (idempotent)       docker-user-firewall.sh --remove   take the rules out
# Env: EXT_IF (external interface, default: autodetect), STATE_DIR (default /var/lib/cbva)
# Only IPv4 is handled: Docker's IPv6 is off by default, and the Vultr Firewall Group covers v6 (see VULTR_FIREWALL.md).
set -euo pipefail

MODE="${EDGE_MODE:-direct}"
STATE_DIR="${STATE_DIR:-/var/lib/cbva}"
CHAIN="CBVA-INGRESS"
EXT_IF="${EXT_IF:-$(ip -o route get 1.1.1.1 2>/dev/null | sed -n 's/.* dev \([^ ]*\).*/\1/p' | head -1)}"

iptables -N DOCKER-USER 2>/dev/null || true     # Docker adopts the chain if it starts later

if [ "${1:-}" = "--remove" ]; then
  while iptables -C DOCKER-USER -i "$EXT_IF" -j "$CHAIN" 2>/dev/null; do iptables -D DOCKER-USER -i "$EXT_IF" -j "$CHAIN"; done
  iptables -F "$CHAIN" 2>/dev/null || true
  iptables -X "$CHAIN" 2>/dev/null || true
  echo "removed $CHAIN"
  exit 0
fi

[ -n "$EXT_IF" ] || { echo "cannot detect the external interface; set EXT_IF" >&2; exit 1; }

# Build the whole rule set as text and load it with ONE atomic iptables-restore transaction: the ":CHAIN -" line
# resets that chain's contents inside the same transaction, so there is never a moment with an empty chain.
RULES="*filter
:${CHAIN} - [0:0]"

allow() {   # allow <source-cidr|any> : new TCP connections whose ORIGINAL destination port (before DNAT) is 80 or 443
  local src=""
  [ "$1" = "any" ] || src="-s $1 "
  for port in 80 443; do
    RULES="${RULES}
-A ${CHAIN} ${src}-p tcp -m conntrack --ctorigdstport ${port} -j RETURN"
  done
}

case "$MODE" in
  direct)
    allow any
    ;;
  cloudflare)
    LIST="$STATE_DIR/cloudflare-ips.list"
    [ -s "$LIST" ] || { echo "$LIST missing or empty: run refresh-cloudflare-ips.sh first" >&2; exit 1; }
    n=0
    while IFS= read -r cidr; do
      case "$cidr" in *:*) continue ;; esac            # IPv6 range: not handled here
      [ -n "$cidr" ] || continue
      allow "$cidr"; n=$((n + 1))
    done < "$LIST"
    [ "$n" -ge 5 ] || { echo "only $n IPv4 Cloudflare ranges in $LIST; refusing to apply" >&2; exit 1; }
    ;;
  *) echo "EDGE_MODE must be direct or cloudflare (got '$MODE')" >&2; exit 1 ;;
esac
RULES="${RULES}
-A ${CHAIN} -m conntrack --ctstate NEW -j DROP
-A ${CHAIN} -j RETURN
COMMIT"
echo "$RULES" | iptables-restore --noflush

iptables -C DOCKER-USER -i "$EXT_IF" -j "$CHAIN" 2>/dev/null || iptables -I DOCKER-USER 1 -i "$EXT_IF" -j "$CHAIN"
echo "DOCKER-USER: mode=$MODE interface=$EXT_IF chain=$CHAIN ($(iptables -S "$CHAIN" | grep -c '^-A') rules)"
