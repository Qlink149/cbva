#!/usr/bin/env bash
# READ-ONLY data verification for a CBVA MongoDB database (mongosh in a throw-away mongo:7 container).
#
#   MONGODB_URL=... DATABASE_NAME=... deploy/verify-data.sh counts                 > counts-before.txt
#   MONGODB_URL=... DATABASE_NAME=... deploy/verify-data.sh snapshot               > docs-before.txt   (optional)
#   MONGODB_URL=... DATABASE_NAME=... deploy/verify-data.sh indexes                > indexes-before.txt (optional)
#   MONGODB_URL=... DATABASE_NAME=... deploy/verify-data.sh compare counts-before.txt [MINUTES] [docs-before.txt] [indexes-before.txt]
#
#   counts    "collection count" per line (the counts-before.txt format)
#   snapshot  "collection<TAB>_id<TAB>md5" per document (canonical EJSON), for an exact created/changed/deleted diff
#   indexes   "collection<TAB>name<TAB>spec" per index
#   compare   count deltas vs counts-before.txt; documents created or modified in the last MINUTES (default 60), found via
#             the ObjectId timestamp of _id and any top-level Date field (updated_at, created_at, last_login, ...);
#             with a snapshot file also the exact list of created / changed / deleted _ids; with an indexes file the index diff.
#
# The connection string is read from the environment only (passed to docker with `-e MONGODB_URL`, never on a command line)
# and is never printed. The script issues only reads: listCollections, countDocuments, find, listIndexes.
# Exit codes: 0 = no differences, 1 = differences found, 2 = usage/connection error.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows: do not rewrite arguments for docker

: "${MONGODB_URL:?set MONGODB_URL in the environment}"
: "${DATABASE_NAME:?set DATABASE_NAME in the environment}"
MODE="${1:-}"
IMAGE="${MONGO_IMAGE:-mongo:7}"

host_only="$(printf '%s' "$MONGODB_URL" | sed -E 's#^[a-z+]+://([^@/]*@)?([^/?]+).*#\2#')"
echo "# db=$DATABASE_NAME host=$host_only mode=$MODE $(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2

mongo_eval() {   # mongo_eval <javascript>; prints the script's output
  docker run --rm -i -e MONGODB_URL -e DATABASE_NAME -e MINUTES "$IMAGE" \
    mongosh --nodb --quiet --eval "$1"
}

JS_CONNECT='
const db = connect(process.env.MONGODB_URL).getSiblingDB(process.env.DATABASE_NAME);
const colls = db.getCollectionNames().filter(n => !n.startsWith("system.")).sort();
'

JS_COUNTS="$JS_CONNECT"'
colls.forEach(n => print(n + " " + db.getCollection(n).countDocuments({})));
'

JS_SNAPSHOT="$JS_CONNECT"'
const crypto = require("crypto");
colls.forEach(n => {
  db.getCollection(n).find({}).forEach(d => {
    const id = EJSON.stringify(d._id, { relaxed: false });
    const h = crypto.createHash("md5").update(EJSON.stringify(d, { relaxed: false })).digest("hex");
    print(n + "\t" + id + "\t" + h);
  });
});
'

JS_INDEXES="$JS_CONNECT"'
colls.forEach(n => db.getCollection(n).getIndexes().forEach(ix => {
  const spec = Object.assign({}, ix); delete spec.v; delete spec.ns;
  print(n + "\t" + ix.name + "\t" + EJSON.stringify(spec, { relaxed: false }));
}));
'

# Recent documents. Sensitive fields are never printed; only identifying fields + the timestamps that matched.
JS_RECENT="$JS_CONNECT"'
const minutes = Number(process.env.MINUTES || "60");
const cutoff = new Date(Date.now() - minutes * 60000);
const SHOW = ["email", "role", "leader_id", "fiscal_year", "slug", "month", "label", "snapshot_type", "round_type", "state",
              "entity_type", "entity_id", "action", "source", "report_fy", "name", "is_current", "is_editable", "planned"];
let total = 0;
colls.forEach(n => {
  const hits = [];
  db.getCollection(n).find({}, { password_hash: 0, refresh_token_hashes: 0, rows: 0, snapshot: 0 }).forEach(d => {
    const why = [];
    if (d._id instanceof ObjectId && d._id.getTimestamp() >= cutoff) why.push("_id created " + d._id.getTimestamp().toISOString());
    Object.keys(d).forEach(k => { if (k !== "_id" && d[k] instanceof Date && d[k] >= cutoff) why.push(k + "=" + d[k].toISOString()); });
    if (why.length) {
      const show = {};
      SHOW.forEach(k => { if (d[k] !== undefined) show[k] = d[k]; });
      hits.push("  " + EJSON.stringify(d._id) + "  [" + why.join(", ") + "]  " + EJSON.stringify(show));
    }
  });
  if (hits.length) { print(n + ": " + hits.length); hits.forEach(h => print(h)); total += hits.length; }
});
print("RECENT_TOTAL " + total + " (cutoff " + cutoff.toISOString() + ", last " + minutes + " min)");
'

case "$MODE" in
  counts)   mongo_eval "$JS_COUNTS" ;;
  snapshot) mongo_eval "$JS_SNAPSHOT" ;;
  indexes)  mongo_eval "$JS_INDEXES" ;;
  compare)
    BEFORE="${2:?usage: verify-data.sh compare counts-before.txt [MINUTES] [docs-before.txt] [indexes-before.txt]}"
    export MINUTES="${3:-60}"
    SNAP_BEFORE="${4:-}"
    IDX_BEFORE="${5:-}"
    [ -f "$BEFORE" ] || { echo "no such file: $BEFORE" >&2; exit 2; }
    work="$(mktemp -d)"
    trap 'rm -f "$work"/*; rmdir "$work"' EXIT
    changed=0

    mongo_eval "$JS_COUNTS" > "$work/now.txt"
    echo "== counts (before -> now)"
    awk 'NR==FNR { b[$1]=$2; next } { n[$1]=$2 }
         END {
           for (c in b) all[c]=1; for (c in n) all[c]=1
           for (c in all) {
             bb = (c in b) ? b[c] : "-"; nn = (c in n) ? n[c] : "-"
             d = ((c in b) && (c in n)) ? n[c]-b[c] : "n/a"
             printf "%-26s %8s -> %-8s %s\n", c, bb, nn, (bb==nn ? "" : "CHANGED (" d ")")
           }
         }' "$BEFORE" "$work/now.txt" | sort
    if ! diff -q <(sort "$BEFORE") <(sort "$work/now.txt") >/dev/null; then changed=1; fi

    echo "== documents created or modified in the last $MINUTES minutes"
    mongo_eval "$JS_RECENT" | tee "$work/recent.txt"
    grep -q '^RECENT_TOTAL 0 ' "$work/recent.txt" || changed=1

    if [ -n "$SNAP_BEFORE" ]; then
      [ -f "$SNAP_BEFORE" ] || { echo "no such file: $SNAP_BEFORE" >&2; exit 2; }
      mongo_eval "$JS_SNAPSHOT" > "$work/snap_now.txt"
      echo "== exact document diff vs $SNAP_BEFORE (by _id and content hash)"
      awk -F'\t' 'NR==FNR { b[$1 FS $2]=$3; next } { n[$1 FS $2]=$3 }
           END {
             for (k in n) { split(k, p, FS); if (!(k in b)) print "CREATED  " p[1] "  " p[2]; else if (b[k] != n[k]) print "CHANGED  " p[1] "  " p[2] }
             for (k in b) { split(k, p, FS); if (!(k in n)) print "DELETED  " p[1] "  " p[2] }
           }' "$SNAP_BEFORE" "$work/snap_now.txt" | sort > "$work/docdiff.txt"
      if [ -s "$work/docdiff.txt" ]; then cat "$work/docdiff.txt"; changed=1; else echo "(no document created, changed or deleted)"; fi
      echo "   totals: $(grep -c '^CREATED' "$work/docdiff.txt" || true) created, $(grep -c '^CHANGED' "$work/docdiff.txt" || true) changed, $(grep -c '^DELETED' "$work/docdiff.txt" || true) deleted"
    fi

    if [ -n "$IDX_BEFORE" ]; then
      [ -f "$IDX_BEFORE" ] || { echo "no such file: $IDX_BEFORE" >&2; exit 2; }
      mongo_eval "$JS_INDEXES" > "$work/idx_now.txt"
      echo "== index diff vs $IDX_BEFORE"
      if diff <(sort "$IDX_BEFORE") <(sort "$work/idx_now.txt") > "$work/idxdiff.txt"; then
        echo "(indexes identical: none created, dropped or changed)"
      else
        sed -e 's/^</  removed:/' -e 's/^>/  added:  /' "$work/idxdiff.txt" | grep -E '^  (removed|added)'
        changed=1
      fi
    fi

    if [ "$changed" = 0 ]; then echo "RESULT: no differences"; else echo "RESULT: differences found (see above)"; fi
    exit "$changed"
    ;;
  *)
    sed -n '2,20p' "$0" >&2
    exit 2
    ;;
esac
