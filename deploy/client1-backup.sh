#!/usr/bin/env bash
set -euo pipefail
umask 077

data=/srv/clients/client1/project/.npm-cache/studio-vkusa-data
backups=/srv/clients/client1/backups
mkdir -p "$backups"

target="$backups/site-$(date +%F).db"
temporary="$target.tmp"
sqlite3 "$data/site.db" ".backup '$temporary'"
mv -f "$temporary" "$target"
sqlite3 "$target" 'PRAGMA integrity_check;'
