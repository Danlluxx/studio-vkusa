#!/usr/bin/env bash
# Stage the Astro site on the Hostkey VPS. Run from the owner's Mac terminal.
# This does not change DNS, expose the site through nginx, or copy local secrets/data.
set -euo pipefail

if [[ $(uname -s) != Darwin ]]; then
  echo 'Run this script in Terminal on the Mac, not on the VPS.' >&2
  exit 1
fi

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
key_file="$HOME/.ssh/studio-vkusa-deploy-ed25519"
server=root@77.91.72.122
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

if [[ ! -r "$key_file" ]]; then
  echo "SSH key not found: $key_file" >&2
  exit 1
fi

ssh_opts=(-i "$key_file" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes)

echo "Checking SSH key access..."
ssh "${ssh_opts[@]}" "$server" 'echo SSH key works'

echo "Packing site source and static media..."
tar -C "$repo_dir/web" -czf "$scratch/site.tar.gz" \
  package.json package-lock.json astro.config.mjs tsconfig.json \
  public src static-media scripts

echo "Transferring site and deployment files..."
scp "${ssh_opts[@]}" "$scratch/site.tar.gz" "$server:/root/studio-vkusa-site.tar.gz"
scp "${ssh_opts[@]}" \
  "$repo_dir/deploy/studio-vkusa.service" \
  "$repo_dir/deploy/studio-vkusa.env.example" \
  "$repo_dir/deploy/backup.sh" \
  "$repo_dir/deploy/studio-vkusa-backup.service" \
  "$repo_dir/deploy/studio-vkusa-backup.timer" \
  "$server:/root/"

echo "Installing Node.js and building site on the VPS..."
ssh "${ssh_opts[@]}" "$server" 'bash -se' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if [[ $(uname -m) != x86_64 ]]; then
  echo "Unexpected CPU architecture: $(uname -m)" >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl xz-utils sqlite3

if [[ ! -e /swapfile ]] && (( $(free -m | awk '/^Mem:/ {print $2}') < 2048 )); then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  printf '%s\n' '/swapfile none swap sw 0 0' >> /etc/fstab
fi

node_version=v22.23.5
node_file="node-${node_version}-linux-x64.tar.xz"
node_base="https://nodejs.org/dist/${node_version}"
if [[ ! -x "/opt/node-${node_version}-linux-x64/bin/node" ]]; then
  curl -fsSLo "/tmp/${node_file}" "${node_base}/${node_file}"
  curl -fsSLo /tmp/node-SHASUMS256.txt "${node_base}/SHASUMS256.txt"
  grep "  ${node_file}$" /tmp/node-SHASUMS256.txt | (cd /tmp && sha256sum -c -)
  tar -C /opt -xJf "/tmp/${node_file}"
  rm -f "/tmp/${node_file}" /tmp/node-SHASUMS256.txt
fi
ln -sfn "/opt/node-${node_version}-linux-x64/bin/node" /usr/bin/node
ln -sfn "/opt/node-${node_version}-linux-x64/bin/npm" /usr/bin/npm
ln -sfn "/opt/node-${node_version}-linux-x64/bin/npx" /usr/bin/npx
node --version

if ! id studio-vkusa >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/studio-vkusa --shell /usr/sbin/nologin studio-vkusa
fi
install -d -o root -g root -m 0755 /opt/studio-vkusa/web
tar --no-same-owner -C /opt/studio-vkusa/web -xzf /root/studio-vkusa-site.tar.gz
cd /opt/studio-vkusa/web
npm ci --no-audit --no-fund
npm run build

install -o root -g root -m 0644 /root/studio-vkusa.service /etc/systemd/system/studio-vkusa.service
if [[ ! -e /etc/studio-vkusa.env ]]; then
  install -o root -g root -m 0600 /root/studio-vkusa.env.example /etc/studio-vkusa.env
fi
install -o root -g root -m 0700 /root/backup.sh /usr/local/sbin/studio-vkusa-backup
install -o root -g root -m 0644 /root/studio-vkusa-backup.service /etc/systemd/system/studio-vkusa-backup.service
install -o root -g root -m 0644 /root/studio-vkusa-backup.timer /etc/systemd/system/studio-vkusa-backup.timer
systemctl daemon-reload
systemctl enable --now studio-vkusa.service
systemctl enable --now studio-vkusa-backup.timer

echo "Service: $(systemctl is-active studio-vkusa.service)"
echo "Backup timer: $(systemctl is-active studio-vkusa-backup.timer)"
curl -fsS --retry 12 --retry-connrefused --retry-delay 2 -o /dev/null -w 'Home HTTP: %{http_code}\n' http://127.0.0.1:4321/
curl -fsS -o /dev/null -w 'Admin HTTP: %{http_code}\n' http://127.0.0.1:4321/admin/login/
echo 'Staging complete. DNS and public web ports were not changed.'
REMOTE
