#!/bin/sh
set -eu

data_dir=/var/lib/studio-vkusa
backup_root=/var/backups/studio-vkusa
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$backup_root/$stamp"

install -d -m 0700 "$backup_root"
install -d -m 0700 "$target"
sqlite3 "$data_dir/site.db" ".backup '$target/site.db'"
tar -C "$data_dir" -czf "$target/uploads.tar.gz" uploads
chmod 0600 "$target/site.db" "$target/uploads.tar.gz"
