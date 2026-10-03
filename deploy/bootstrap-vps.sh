#!/usr/bin/env bash
# One-time VPS hardening for Ubuntu 22.04/24.04. Run as root, with the other deploy/*.sh scripts next to this file:
#   EDGE_MODE=direct|cloudflare  SSH_ALLOW_IP=<your.ip>  bash bootstrap-vps.sh <deploy-user> "<ssh-public-key>"
#
# EDGE_MODE=direct (default): browsers -> Caddy (Let's Encrypt) -> api. No Cloudflare.
#   ufw: 22 only from SSH_ALLOW_IP (REQUIRED, or SSH_ALLOW_ANYWHERE=1 to knowingly leave it open), 80 and 443 from anywhere
#   (80 is needed for ACME HTTP-01 validation and the HTTP->HTTPS redirect). No Cloudflare cron.
# EDGE_MODE=cloudflare: browsers -> Cloudflare -> Caddy -> api. 80/443 only from Cloudflare's ranges (daily refresh cron).
#   That restriction is REQUIRED in this mode: the API trusts the client IP Caddy takes from CF-Connecting-IP.
#
# ufw does NOT filter Docker-published ports (they go through NAT/FORWARD). Both modes therefore also install the
# DOCKER-USER rules from docker-user-firewall.sh as the cbva-firewall systemd service (re-applied on every boot).
# Also set the Vultr Firewall Group as described in VULTR_FIREWALL.md: it is enforced before traffic reaches the VM.
# SAFETY: confirm you can SSH in as <deploy-user> from a SECOND terminal before closing this session.
set -euo pipefail

DEPLOY_USER="${1:?usage: bootstrap-vps.sh <deploy-user> \"<ssh-public-key>\"}"
PUBKEY="${2:?provide the ssh public key for $DEPLOY_USER}"
[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

EDGE_MODE="${EDGE_MODE:-direct}"
case "$EDGE_MODE" in direct|cloudflare) ;; *) echo "EDGE_MODE must be direct or cloudflare (got '$EDGE_MODE')"; exit 1 ;; esac
if [ -z "${SSH_ALLOW_IP:-}" ] && [ "${SSH_ALLOW_ANYWHERE:-0}" != 1 ]; then
  echo "Set SSH_ALLOW_IP=<your public IP> so port 22 is not open to the world (or SSH_ALLOW_ANYWHERE=1 to accept that)."; exit 1
fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/docker-user-firewall.sh" ] || { echo "docker-user-firewall.sh must be next to this script"; exit 1; }
if [ "$EDGE_MODE" = cloudflare ]; then
  [ -f "$HERE/refresh-cloudflare-ips.sh" ] || { echo "refresh-cloudflare-ips.sh must be next to this script (cloudflare mode)"; exit 1; }
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades curl ca-certificates

# --- deploy user + key-only SSH ---
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG sudo "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
grep -qxF "$PUBKEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null || echo "$PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"; chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
CONF
sshd -t && systemctl reload ssh

# --- firewall (ufw covers the host itself; Docker-published ports are covered by DOCKER-USER below) ---
ufw default deny incoming
ufw default allow outgoing
if [ -n "${SSH_ALLOW_IP:-}" ]; then
  ufw allow from "$SSH_ALLOW_IP" to any port 22 proto tcp
else
  ufw allow 22/tcp
fi
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/cbva
install -m 755 "$HERE/docker-user-firewall.sh" /usr/local/sbin/cbva-docker-firewall
case "$EDGE_MODE" in
  direct)
    ufw allow 80/tcp
    ufw allow 443/tcp
    # leftovers from an earlier cloudflare-mode setup, if any
    rm -f /etc/cron.d/cbva-cloudflare-ips
    if [ -x /usr/local/sbin/cbva-refresh-cloudflare-ips ]; then /usr/local/sbin/cbva-refresh-cloudflare-ips --remove || true; fi
    ;;
  cloudflare)
    install -m 755 "$HERE/refresh-cloudflare-ips.sh" /usr/local/sbin/cbva-refresh-cloudflare-ips
    # adds ufw rules for 80/443 from Cloudflare only, writes /opt/cbva/cloudflare-ips.conf for Caddy, applies DOCKER-USER
    /usr/local/sbin/cbva-refresh-cloudflare-ips
    cat > /etc/cron.d/cbva-cloudflare-ips <<'CRON'
17 3 * * * root /usr/local/sbin/cbva-refresh-cloudflare-ips >> /var/log/cbva-cloudflare-ips.log 2>&1
CRON
    chmod 644 /etc/cron.d/cbva-cloudflare-ips
    ;;
esac
ufw --force enable

# --- 2 GB swap ---
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf && sysctl -p /etc/sysctl.d/99-swappiness.conf

# --- Docker (official convenience script) ---
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
usermod -aG docker "$DEPLOY_USER"

# --- DOCKER-USER ingress rules, re-applied after docker on every boot ---
cat > /etc/systemd/system/cbva-firewall.service <<UNIT
[Unit]
Description=CBVA ingress rules for Docker-published ports (EDGE_MODE=$EDGE_MODE)
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
Environment=EDGE_MODE=$EDGE_MODE
ExecStart=/usr/local/sbin/cbva-docker-firewall

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now cbva-firewall.service

# --- fail2ban, auto security updates, timezone ---
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades || true
timedatectl set-timezone Asia/Kolkata

# --- app directory ---
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/cbva

if [ "$EDGE_MODE" = direct ]; then
  echo "Done (direct mode). Next: copy deploy/docker-compose.yml, deploy/Caddyfile and a chmod-600 .env (with SITE_ADDRESS=...) into /opt/cbva, and set the Vultr Firewall Group (deploy/VULTR_FIREWALL.md). See deploy/README.md."
else
  echo "Done (cloudflare mode). Next: copy docker-compose.yml, docker-compose.cloudflare.yml, Caddyfile.cloudflare, the Origin CA cert/key (certs/origin.pem|key) and a chmod-600 .env (CADDYFILE=./Caddyfile.cloudflare, EDGE_MODE=cloudflare) into /opt/cbva. See deploy/README.md."
fi
