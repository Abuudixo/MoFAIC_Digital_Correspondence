#!/usr/bin/env sh
set -eu
umask 077

: "${DATABASE_URL:?Set DATABASE_URL through the approved secret manager}"
: "${BACKUP_GPG_RECIPIENT:?Set the separately managed public GPG backup-key fingerprint}"

backup_directory=${BACKUP_DIRECTORY:-/var/backups/mofaic}
retention_days=${BACKUP_RETENTION_DAYS:-30}
case "$retention_days" in
  ''|*[!0-9]*)
    printf '%s\n' 'BACKUP_RETENTION_DAYS must be a non-negative integer.' >&2
    exit 1
    ;;
esac

mkdir -p "$backup_directory"
chmod 700 "$backup_directory"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary_file="$backup_directory/.mofaic-$timestamp.dump.gpg.tmp"
backup_file="$backup_directory/mofaic-$timestamp.dump.gpg"
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM

pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" |
  gpg --batch --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
    --output "$temporary_file"
chmod 600 "$temporary_file"
mv "$temporary_file" "$backup_file"
trap - EXIT HUP INT TERM

find "$backup_directory" -maxdepth 1 -type f \
  -name 'mofaic-*.dump.gpg' -mtime "+$retention_days" -delete
printf 'Encrypted backup written: %s\n' "$backup_file"
