#!/usr/bin/env bash
# One-time VPS hardening for Ubuntu 22.04/24.04. Run as root, with refresh-cloudflare-ips.sh next to this file:
#   [SSH_ALLOW_IP=<your.ip>] bash bootstrap-vps.sh <deploy-user> "<ssh-public-key>"
# Firewall: 22 open (only to SSH_ALLOW_IP if set); 80/443 open ONLY to Cloudflare's published ranges.
# That ingress restriction is REQUIRED: the API trusts the client IP that Caddy derives from Cloudflare's
# CF-Connecting-IP, which is only trustworthy if nothing but Cloudflare can reach Caddy.
# SAFETY: confirm you can SSH in as <deploy-user> from a SECOND terminal before closing this session.
set -euo pipefail

DEPLOY_USER="${1:?usage: bootstrap-vps.sh <deploy-user> \"<ssh-public-key>\"}"
PUBKEY="${2:?provide the ssh public key for $DEPLOY_USER}"
[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

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

# --- firewall: SSH + Cloudflare-only web ---
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -x "$HERE/refresh-cloudflare-ips.sh" ] || { echo "refresh-cloudflare-ips.sh must be next to this script (and executable)"; exit 1; }
ufw default deny incoming
ufw default allow outgoing
if [ -n "${SSH_ALLOW_IP:-}" ]; then
  ufw allow from "$SSH_ALLOW_IP" to any port 22 proto tcp
else
  ufw allow 22/tcp
fi
ufw --force enable
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/cbva
install -m 755 "$HERE/refresh-cloudflare-ips.sh" /usr/local/sbin/cbva-refresh-cloudflare-ips
# adds ufw rules for 80/443 from Cloudflare only and writes /opt/cbva/cloudflare-ips.conf for Caddy
/usr/local/sbin/cbva-refresh-cloudflare-ips
cat > /etc/cron.d/cbva-cloudflare-ips <<'CRON'
17 3 * * * root /usr/local/sbin/cbva-refresh-cloudflare-ips >> /var/log/cbva-cloudflare-ips.log 2>&1
CRON
chmod 644 /etc/cron.d/cbva-cloudflare-ips

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

# --- fail2ban, auto security updates, timezone ---
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades || true
timedatectl set-timezone Asia/Kolkata

# --- app directory ---
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/cbva

echo "Done. Next: copy deploy/docker-compose.yml, deploy/Caddyfile, the Cloudflare Origin CA cert/key (certs/origin.pem, certs/origin.key) and a chmod-600 .env into /opt/cbva (see deploy/README.md)."
