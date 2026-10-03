#!/usr/bin/env bash
# Restore test: restore the NEWEST backup from $BACKUP_DIR into a scratch database and compare per-collection
# document counts with the counts recorded at backup time. Prints "BACKUP VERIFIED" and exits 0, or exits 1.
#
#   RESTORE_MONGODB_URL='mongodb+srv://...' deploy/restore-test.sh
#
# Env:
#   RESTORE_MONGODB_URL  (required) cluster to restore INTO. Never the production database: the scratch database
#                        name is forced to cbva_restore_test_* and must be empty; it is dropped afterwards.
#   RESTORE_DB           scratch database name (default cbva_restore_test_<UTC timestamp>; must start with cbva_restore_test)
#   BACKUP_DIR           default /home/deploy/backups
#   KEEP_RESTORE=1       keep the scratch database for inspection
# The URI is never printed and never on a command line (it reaches the mongo container as an environment variable).
set -euo pipefail
umask 077
export MSYS_NO_PATHCONV=1

BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups}"
IMAGE="${MONGO_IMAGE:-mongo:7}"
RESTORE_DB="${RESTORE_DB:-cbva_restore_test_$(date -u +%Y%m%d%H%M%S)}"

fail() { printf 'RESTORE TEST FAILED: %s\n' "$*" >&2; exit 1; }

: "${RESTORE_MONGODB_URL:?set RESTORE_MONGODB_URL (cluster to restore into; scratch database only)}"
case "$RESTORE_DB" in cbva_restore_test*) ;; *) fail "RESTORE_DB must start with cbva_restore_test (got $RESTORE_DB)";; esac
case "$RESTORE_DB" in *[!A-Za-z0-9_]*) fail "RESTORE_DB has unexpected characters";; esac
export RESTORE_MONGODB_URL RESTORE_DB

archive="$(ls -1 "$BACKUP_DIR"/cbva-*-*.archive.gz 2>/dev/null | LC_ALL=C sort | tail -n 1 || true)"
[ -n "$archive" ] || fail "no backups in $BACKUP_DIR"
counts_file="${archive%.archive.gz}.counts"
[ -s "$counts_file" ] || fail "missing counts file for $(basename "$archive")"
src_db="$(basename "$archive" | sed -E 's/^cbva-(.+)-[0-9]{8}T[0-9]{6}Z\.archive\.gz$/\1/')"
[ -n "$src_db" ] && [ "$src_db" != "$RESTORE_DB" ] || fail "cannot derive the source database from $(basename "$archive")"
export SRC_DB="$src_db"
echo "backup:  $(basename "$archive") ($(du -h "$archive" | cut -f1)), source db: $src_db"
echo "restore: into scratch db $RESTORE_DB"

mongo_eval() { docker run --rm -i -e RESTORE_MONGODB_URL -e RESTORE_DB "$IMAGE" mongosh --nodb --quiet --eval "$1"; }
JS_DB='const db = connect(process.env.RESTORE_MONGODB_URL).getSiblingDB(process.env.RESTORE_DB);'

existing="$(mongo_eval "$JS_DB print(db.getCollectionNames().filter(n => !n.startsWith('system.')).length)")"
[ "$existing" = 0 ] || fail "scratch database $RESTORE_DB is not empty ($existing collections); refusing to touch it"

drop_scratch() {
  if [ "${KEEP_RESTORE:-0}" = 1 ]; then echo "kept scratch database $RESTORE_DB"; return; fi
  mongo_eval "$JS_DB if (db.getName().startsWith('cbva_restore_test')) { db.dropDatabase(); print('dropped ' + db.getName()); }" || true
}
trap drop_scratch EXIT

docker run --rm -i -e RESTORE_MONGODB_URL -e RESTORE_DB -e SRC_DB "$IMAGE" \
  sh -c 'exec mongorestore --uri="$RESTORE_MONGODB_URL" --archive --gzip --nsInclude="$SRC_DB.*" \
         --nsFrom="$SRC_DB.*" --nsTo="$RESTORE_DB.*" --quiet' < "$archive" || fail "mongorestore failed"

restored="$(mongo_eval "$JS_DB db.getCollectionNames().filter(n => !n.startsWith('system.')).sort()
  .forEach(n => print(n + ' ' + db.getCollection(n).countDocuments({})));" | LC_ALL=C sort)"

# compare: restored count must equal the count at backup time (or lie between before/after if the source
# changed while the dump ran)
report="$(LC_ALL=C join -a1 -a2 -e MISSING -o 0,1.2,1.3,2.2 <(LC_ALL=C sort "$counts_file") <(printf '%s\n' "$restored"))"
bad=0
printf '%-28s %10s %10s  %s\n' collection backup restored result
while read -r coll before after got; do
  [ -n "$coll" ] || continue
  lo=$before; hi=$after
  if [ "$before" != MISSING ] && [ "$after" != MISSING ] && [ "$after" -lt "$before" ]; then lo=$after; hi=$before; fi
  if [ "$got" != MISSING ] && [ "$before" != MISSING ] && [ "$got" -ge "$lo" ] && [ "$got" -le "$hi" ]; then res=ok
  elif [ "$got" = MISSING ] && [ "$before" = 0 ]; then res="ok (empty collection)"
  else res=MISMATCH; bad=1; fi
  shown=$before; [ "$before" = "$after" ] || shown="$before..$after"
  printf '%-28s %10s %10s  %s\n' "$coll" "$shown" "$got" "$res"
done <<< "$report"

[ "$bad" = 0 ] || fail "per-collection counts differ"
echo "BACKUP VERIFIED: $(basename "$archive") restores with matching counts for $(printf '%s\n' "$report" | grep -c .) collections"
