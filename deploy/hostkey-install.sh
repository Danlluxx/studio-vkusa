#!/usr/bin/env bash
# Install an encrypted, locally prepared release after it has been decrypted on the VPS.
# Does not publish the site or change DNS.
set -euo pipefail

archive=${1:-/root/studio-vkusa-site.tar.gz}
prebuilt_dist_archive=${2:-}
staging=/root/studio-vkusa-payload
app=/opt/studio-vkusa/web
data=/var/lib/studio-vkusa

if [[ $(id -u) != 0 ]]; then
  echo 'Run as root on the VPS.' >&2
  exit 1
fi

install -d -m 0700 "$staging"
tar --no-same-owner -C "$staging" -xzf "$archive"
test -f "$staging/web/package-lock.json"
test -f "$staging/data/site.db"

export DEBIAN_FRONTEND=noninteractive
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
  useradd --system --user-group --home-dir "$data" --shell /usr/sbin/nologin studio-vkusa
fi
install -d -o studio-vkusa -g studio-vkusa -m 0750 "$data" "$data/uploads"
if [[ ! -e "$data/site.db" ]]; then
  install -o studio-vkusa -g studio-vkusa -m 0640 "$staging/data/site.db" "$data/site.db"
fi
if [[ -d "$staging/data/uploads" ]]; then
  cp -an "$staging/data/uploads/." "$data/uploads/"
  chown -R studio-vkusa:studio-vkusa "$data/uploads"
fi

install -d -o root -g root -m 0755 "$app"
cp -a "$staging/web/." "$app/"
cd "$app"
npm ci --no-audit --no-fund
if [[ -n "$prebuilt_dist_archive" ]]; then
  # This VPS cannot execute Astro's build toolchain (Illegal instruction).
  # The supplied archive must contain dist/ built with Node.js 22.23.4+.
  tar --no-same-owner -C "$app" -xzf "$prebuilt_dist_archive"
  test -f "$app/dist/server/entry.mjs"
else
  npm run build
fi

install -o root -g root -m 0644 "$staging/deploy/studio-vkusa.service" /etc/systemd/system/studio-vkusa.service
if [[ ! -e /etc/studio-vkusa.env ]]; then
  install -o root -g root -m 0600 "$staging/deploy/studio-vkusa.env.example" /etc/studio-vkusa.env
fi
install -o root -g root -m 0700 "$staging/deploy/backup.sh" /usr/local/sbin/studio-vkusa-backup
install -o root -g root -m 0644 "$staging/deploy/studio-vkusa-backup.service" /etc/systemd/system/studio-vkusa-backup.service
install -o root -g root -m 0644 "$staging/deploy/studio-vkusa-backup.timer" /etc/systemd/system/studio-vkusa-backup.timer
systemctl daemon-reload
systemctl enable --now studio-vkusa.service
systemctl enable --now studio-vkusa-backup.timer

echo "Service: $(systemctl is-active studio-vkusa.service)"
echo "Backup timer: $(systemctl is-active studio-vkusa-backup.timer)"
curl -fsS --retry 12 --retry-connrefused --retry-delay 2 -o /dev/null -w 'Home HTTP: %{http_code}\n' http://127.0.0.1:4321/
curl -fsS -o /dev/null -w 'Admin HTTP: %{http_code}\n' http://127.0.0.1:4321/admin/login/
echo 'Staging complete. DNS and public web ports were not changed.'
