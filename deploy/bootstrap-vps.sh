#!/usr/bin/env bash
# One-time VPS hardening for Ubuntu 22.04/24.04. Run as root:  bash bootstrap-vps.sh <deploy-user> "<ssh-public-key>"
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

# --- firewall: 22/80/443 only ---
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
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

# --- fail2ban, auto security updates, timezone ---
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades || true
timedatectl set-timezone Asia/Kolkata

# --- app directory ---
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/cbva

echo "Done. Next: copy deploy/docker-compose.yml, deploy/Caddyfile and a chmod-600 .env into /opt/cbva (see deploy/README.md)."
