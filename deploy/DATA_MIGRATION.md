# Moving the existing CBVA data into the production database

Commands below were run for real against a local MongoDB 7.0.14 with MongoDB Database Tools 100.10.0 (dump, restore into a
differently named DB, re-run with `--drop`, then the two verification commands). Not yet run against Atlas or the real
CBVA data: see "Not verified" at the end.

Placeholders: `SOURCE_URI`/`SOURCE_DB` = current database (e.g. the dev/Vercel-era Atlas cluster), `TARGET_URI`/`TARGET_DB` =
the new production database (the `MONGODB_URL` / `DATABASE_NAME` the API container will use).

## 0. Before you start

- Install the tools on the machine that runs the dump/restore: `mongodb-database-tools` (mongodump, mongorestore).
- The target must already allow your IP (Atlas Network Access) **and** the VPS IP. The DB user needs `readWrite` on `TARGET_DB`
  (restore with `--drop` needs `dropCollection`, which `readWrite` includes).
- Freeze writes on the source (put the old app in maintenance / stop it) so the dump is consistent.
- Take a safety copy of the target if it is not empty: run the dump in step 1 against the target first.

## 1. Dump the source

```bash
# NOTE: mongodump has no --nsInclude (only mongorestore does); select the database with --db.
mongodump --uri "$SOURCE_URI" --db "$SOURCE_DB" \
  --gzip --archive="cbva-$(date +%F).archive.gz" \
  --readPreference=secondaryPreferred
# optional: leave out volatile history
#   --excludeCollection=audit_log
```

## 2. Restore into the target (renames the DB if the names differ)

```bash
mongorestore --uri "$TARGET_URI" --gzip --archive="cbva-YYYY-MM-DD.archive.gz" \
  --nsInclude "$SOURCE_DB.*" \
  --nsFrom "$SOURCE_DB.*" --nsTo "$TARGET_DB.*" \
  --drop
```

- `--drop` drops each collection that is **in the dump** before restoring it, so re-running is safe and idempotent. Collections
  not in the dump (for example ones the API created after bootstrap) are left alone.
- Indexes are restored from the dump's metadata. Step 4 checks them against what `app/core/database.py` expects.
- Do the restore **before** `python -m app.cli bootstrap`; bootstrap then only adds what is missing (it never overwrites an
  existing admin).

## 3. Demo accounts and bootstrap

```bash
cd /opt/cbva
docker compose run --rm --no-deps api python -m app.cli bootstrap            # admin (if absent), KRA seed, current FY
docker compose run --rm --no-deps api python -m app.cli check-demo-users     # read-only; exit 1 if admin@cbva.com / mm@* / vc@* exist
docker compose run --rm --no-deps api python -m app.cli check-demo-users --deactivate   # after your real admin can log in
```

## 4. Verify: indexes and counts

```bash
# every index database.py defines exists on the target (exit 1 + list if any are missing; add --create to build them)
docker compose run --rm --no-deps api python -m app.cli verify-indexes

# per-collection document counts, source vs target (exit 1 if any differ)
docker compose run --rm --no-deps \
  -e SOURCE_MONGODB_URL="$SOURCE_URI" -e SOURCE_DATABASE_NAME="$SOURCE_DB" \
  api python -m app.cli compare-counts
# limit to some collections: ... compare-counts --collections users engagements leaders
```

Expected differences right after migration: `audit_log` (bootstrap/logins add rows), and `users` if bootstrap created an admin
that did not exist in the source. Anything else is a failed restore.

Manual spot check of the indexes if you prefer the shell:

```javascript
// mongosh "$TARGET_URI/$TARGET_DB"
db.getCollectionNames().forEach(c => { print(c); printjson(db[c].getIndexes().map(i => ({name:i.name, key:i.key, unique:!!i.unique}))) })
```

## 5. What a fresh (empty) database is missing: screen / endpoint → data needed

Measured by bootstrapping an empty DB, logging in as the bootstrapped admin and calling every GET the frontend uses.
Bootstrap provides: 1 admin user, 4 KRA categories, 17 KPI definitions, 12 KRA weights, 4 competencies, the current FY.

| Screen (route) | Endpoints | Needs from the migrated data | Empty-DB result |
|---|---|---|---|
| Sign-in `/home`, every page header | `/api/auth/*`, `/api/financial-years/` | `users` (with real `leader_id` per leader user), `financial_years` for **every FY you want selectable** (bootstrap only creates the current one; history such as `2526` must come from the dump) | works; FY picker shows 1 FY |
| Leader dashboard `/`, `/my-plan/dashboard` | `/api/pipeline`, `/api/collections`, `/api/bluesky`, `/api/engagements`, `/api/el-summary`, `/api/baselines` | `leaders` (ids referenced by `users.leader_id`), per-leader `engagements`, `pipeline_snapshots`, `collection_entries`, `blue_sky_entries`, `el_summaries`, `baseline_plans`. Collections / Blue Sky / EL rows are auto-created on first read (7 rows, 7 rows, 1 row), so these never 404 | 200, all zeros |
| Engagements / Clients `/my-plan`, `/my-plan/clients[/:id]`, `/my-plan/engagements` | `/api/engagements`, `/api/admin/clients`, `/api/admin/engagement-types`, `/api/engagement-actions` | `engagements`, `clients`, `engagement_types`, `engagement_actions` | empty tables; client/type dropdowns empty |
| Collections `/my-plan/collections` | `/api/collections`, `/api/collection-transactions` | `collection_entries`, `collection_transactions` | 7 auto rows, no transactions |
| Team / hiring `/my-plan/team` | `/api/team`, `/api/hiring`, `/api/headcount` | `team_members`, `hiring_requirements`, `headcount_plans` | empty |
| Pipeline `/my-plan/pipeline` | `/api/pipeline`, `/api/pipeline/fy-actuals` | `pipeline_snapshots` | empty |
| Actions / Meetings | `/api/actions`, `/api/tasks`, `/api/client-meetings`, `/api/additional-work` | `actions`, `tasks`, `client_meetings`, `additional_work` | empty |
| Scorecard `/my-plan/scorecard` | `/api/kra/*`, `/api/appraisals/*` | `kra_*`, `kpi_definitions`, `leadership_competencies` (bootstrap seeds defaults; restore overrides them with your tuned weights), `appraisal_rounds` / `kpi_ratings` / `competency_ratings` (rounds auto-created on read; ratings only from the dump) | works with default KRA data; no historic ratings |
| Firm view: Consolidated `/firmwide/consolidated` | `/api/consolidated-summary/?fiscal_year=` | a `consolidated_summaries` document per report FY **in Mongo** (the source xlsx is not in the image) plus `leaders`, `engagements`, `collection_*` | **503** with a clear message until seeded (the dev machine returned 82 rows only because the xlsx exists locally) |
| Firm view: Clients / Origination / Board pack | `/api/firmwide/*`, `/api/new-clients/` | `leaders`, `engagements`, `pipeline_snapshots`, `baseline_plans`, `additional_work`, `audit_log` (new-client detection reads it) | empty lists |
| Change log `/firmwide/change-log` (admin) | `/api/audit-log/` | `audit_log` (history only exists if you migrate it) | shows only post-bootstrap events |
| Admin `/admin` | `/api/admin/users`, `/settings`, `/clients`, `/engagement-types`, `/financial-years`, `/plans` | `users`, `app_settings`, `clients`, `engagement_types`, `financial_years`, `baseline_plans` | users/FY populated; clients/types/plans empty |

Collections the API does **not** create indexes for (so `verify-indexes` will not list them, but they must be in the dump):
`leaders`, `clients`, `engagement_types`, `app_settings`, `financial_years`.

**Minimum viable migration**: dump everything. If you must trim, the screens above break without `leaders`, `users`,
`financial_years`, `engagements`, `clients`, `engagement_types`, `consolidated_summaries`.

## Not verified

- Against Atlas (privileges, `--readPreference`, SRV URIs with `mongodump`), and against the real CBVA data (size, timing).
- Restoring into a database that already holds production traffic.
