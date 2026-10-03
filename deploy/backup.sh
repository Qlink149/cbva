#!/usr/bin/env bash
# Daily MongoDB backup: mongodump --gzip archive of $DATABASE_NAME into $BACKUP_DIR, keep $KEEP_DAYS days.
#
#   deploy/backup.sh                 # on the VPS: reads MONGODB_URL / DATABASE_NAME from /opt/cbva/.env
#   ENV_FILE=/path/.env deploy/backup.sh
#   MONGODB_URL=... DATABASE_NAME=... deploy/backup.sh   # already in the environment: the file is not read
#
# Output per run (names sort by time):
#   cbva-<db>-<UTC timestamp>.archive.gz   mongodump --archive --gzip of the one database
#   cbva-<db>-<UTC timestamp>.counts       per-collection document counts taken right before AND right after
#                                          the dump ("<collection> <before> <after>"), used by restore-test.sh
# The URI is never printed, never put on a command line (it reaches the mongo container as an environment
# variable) and the .env file is parsed, not sourced. Any failure exits non-zero and leaves no partial files;
# old backups are pruned only after a successful run. Needs: docker (mongo:7 image), gzip, coreutils (flock optional).
set -euo pipefail
umask 077
export MSYS_NO_PATHCONV=1   # Git Bash on Windows (testing): do not rewrite docker arguments

ENV_FILE="${ENV_FILE:-/opt/cbva/.env}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
IMAGE="${MONGO_IMAGE:-mongo:7}"

log() { printf '%s backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "FAILED: $*" >&2; exit 1; }

env_value() {   # env_value <KEY>: value of KEY=... from $ENV_FILE (last one wins; surrounding quotes removed)
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" | tail -n 1 | sed -e 's/[[:space:]]*$//' \
    -e "s/^'\(.*\)'$/\1/" -e 's/^"\(.*\)"$/\1/'
}

if [ -z "${MONGODB_URL:-}" ]; then
  [ -r "$ENV_FILE" ] || die "cannot read $ENV_FILE (and MONGODB_URL is not set)"
  MONGODB_URL="$(env_value MONGODB_URL)"
  DATABASE_NAME="${DATABASE_NAME:-$(env_value DATABASE_NAME)}"
fi
[ -n "${MONGODB_URL:-}" ] || die "MONGODB_URL is empty"
DATABASE_NAME="${DATABASE_NAME:-cbva}"
case "$DATABASE_NAME" in *[!A-Za-z0-9_-]*|"") die "unexpected DATABASE_NAME";; esac
export MONGODB_URL DATABASE_NAME

command -v docker >/dev/null || die "docker not found"
mkdir -p "$BACKUP_DIR"
if command -v flock >/dev/null; then
  exec 9>"$BACKUP_DIR/.backup.lock"
  flock -n 9 || die "another backup is running"
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="$BACKUP_DIR/cbva-$DATABASE_NAME-$stamp"
tmp_archive="$base.archive.gz.partial"
tmp_counts="$base.counts.partial"
cleanup() { rm -f "$tmp_archive" "$tmp_counts" "$base.before"; }
trap 'cleanup; die "interrupted or failed (line $LINENO)"' ERR INT TERM

counts() {   # "<collection> <count>" for every collection, sorted
  docker run --rm -i -e MONGODB_URL -e DATABASE_NAME "$IMAGE" mongosh --nodb --quiet --eval '
    const db = connect(process.env.MONGODB_URL).getSiblingDB(process.env.DATABASE_NAME);
    db.getCollectionNames().filter(n => !n.startsWith("system.")).sort()
      .forEach(n => print(n + " " + db.getCollection(n).countDocuments({})));'
}

log "start db=$DATABASE_NAME dir=$BACKUP_DIR"
counts | LC_ALL=C sort > "$base.before"
[ -s "$base.before" ] || die "could not read collection counts (connection?)"

# the URI stays inside the container's environment; stdout is the archive
docker run --rm -i -e MONGODB_URL -e DATABASE_NAME "$IMAGE" \
  sh -c 'exec mongodump --uri="$MONGODB_URL" --db="$DATABASE_NAME" --archive --gzip --quiet' > "$tmp_archive"

[ -s "$tmp_archive" ] || die "empty archive"
gzip -t "$tmp_archive" || die "archive is not valid gzip"

after="$(counts | LC_ALL=C sort)"
[ -n "$after" ] || die "could not re-read collection counts"
LC_ALL=C join -a1 -a2 -e 0 -o 0,1.2,2.2 "$base.before" <(printf '%s\n' "$after") > "$tmp_counts"
rm -f "$base.before"

mv "$tmp_archive" "$base.archive.gz"
mv "$tmp_counts" "$base.counts"
trap - ERR INT TERM

size="$(du -h "$base.archive.gz" | cut -f1)"
colls="$(wc -l < "$base.counts" | tr -d ' ')"
drift="$(awk '$2 != $3' "$base.counts" | wc -l | tr -d ' ')"
log "ok $(basename "$base.archive.gz") size=$size collections=$colls changed_during_dump=$drift"

# retention: only our own files, only after a successful backup
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "cbva-$DATABASE_NAME-*.archive.gz" -o -name "cbva-$DATABASE_NAME-*.counts" \) \
  -mtime +"$((KEEP_DAYS - 1))" -print -delete | sed 's/^/pruned /'
exit 0
