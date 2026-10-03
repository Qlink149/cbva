"""Temporary accounts for the end-to-end suites (API: tests/e2e, UI: tests/e2e/ui).

    python tests/e2e/provision.py create    # 2 temporary leaders + 4 temporary users, passwords -> tests/e2e/.state.json
    python tests/e2e/provision.py cleanup   # deletes them AND every document the e2e runs created (strict filters)
    python tests/e2e/provision.py report    # read-only: what cleanup would delete

Env: E2E_MONGODB_URL, E2E_DATABASE_NAME. The database name must look like a verification/test copy
(cbva_verify*, *_test, *_staging); a production-looking name is refused. The URL is never printed or written.
"""
import json
import os
import re
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
from pymongo import MongoClient

STATE = Path(__file__).with_name(".state.json")
LEADERS = {"e2e_leader_a": "E2E Leader A", "e2e_leader_b": "E2E Leader B"}
USERS = [  # key, email, role, leader_id
    ("admin", "e2e-admin@example.com", "admin", None),
    ("management", "e2e-management@example.com", "management", None),
    ("leader_a", "e2e-leader-a@example.com", "user", "e2e_leader_a"),
    ("leader_b", "e2e-leader-b@example.com", "user", "e2e_leader_b"),
]
E2E_EMAIL_RE = r"^e2e-.*@example\.com$"
LABEL_RE = r"^E2E"          # names/titles/labels of records the suites create start with "E2E"
LEADER_SCOPED = ["engagements", "engagement_actions", "pipeline_snapshots", "blue_sky_entries", "collection_entries",
                 "collection_transactions", "actions", "tasks", "team_members", "hiring_requirements", "headcount_plans",
                 "baseline_plans", "el_summaries", "client_meetings", "additional_work", "assessments", "appraisal_rounds",
                 "kpi_definitions", "kra_weight_config", "leadership_competencies"]


def _db():
    name = os.environ.get("E2E_DATABASE_NAME", "")
    if not re.match(r"^(cbva_verify[a-z0-9_]*|[a-z0-9_]+_test|[a-z0-9_]+_staging)$", name):
        sys.exit(f"refusing: E2E_DATABASE_NAME={name!r} does not look like a verification/test database")
    return MongoClient(os.environ["E2E_MONGODB_URL"], serverSelectionTimeoutMS=10000)[name]


def _filters(db):
    users = list(db.users.find({"email": {"$regex": E2E_EMAIL_RE}}, {"_id": 1, "created_at": 1}))
    user_ids = [str(u["_id"]) for u in users]
    leader_ids = list(LEADERS)
    since = min((u["created_at"] for u in users if u.get("created_at")), default=None)
    # documents an e2e account created, found through its audit entries (covers records without an "E2E" label,
    # e.g. bodies the validation sweep got stored by endpoints that accepted raw dicts)
    created = lambda etype: [db_id for db_id in (
        a.get("entity_id") for a in db.audit_log.find({"actor_id": {"$in": user_ids}, "entity_type": etype,
                                                        "action": "created"}, {"entity_id": 1}))]
    def oids(xs):
        from bson import ObjectId
        return [ObjectId(x) for x in xs if x and ObjectId.is_valid(str(x))]
    f = {
        "users": {"email": {"$regex": E2E_EMAIL_RE}},
        "leaders": {"$or": [{"_id": {"$in": leader_ids}}, {"name": {"$regex": LABEL_RE}}]},
        "clients": {"$or": [{"name": {"$regex": LABEL_RE}}, {"_id": {"$in": oids(created("client"))}}]},
        "engagement_types": {"$or": [{"name": {"$regex": LABEL_RE}}, {"_id": {"$in": oids(created("engagement_type"))}}]},
        "financial_years": {"label": {"$regex": LABEL_RE}},
        "audit_log": {"$or": [{"actor_id": {"$in": user_ids}}, {"leader_id": {"$in": leader_ids}},
                              {"entity_label": {"$regex": LABEL_RE}}, {"entity_id": {"$in": user_ids + leader_ids}}]},
    }
    for c in LEADER_SCOPED:
        f[c] = {"leader_id": {"$in": leader_ids}}
    if since:   # GET /api/appraisals/rounds used to create rounds for any leader_id / FY string (validation sweep)
        real = [l["_id"] for l in db.leaders.find({"_id": {"$nin": leader_ids}}, {"_id": 1})]
        f["appraisal_rounds"] = {"$or": [f["appraisal_rounds"], {"created_at": {"$gte": since}, "$or": [
            {"leader_id": {"$nin": real}}, {"fiscal_year": {"$not": {"$regex": r"^\d{4}$"}}}]}]}
    # ratings belong to the rounds removed above
    rounds = [str(r["_id"]) for r in db.appraisal_rounds.find(f["appraisal_rounds"], {"_id": 1})]
    f["kpi_ratings"] = {"round_id": {"$in": rounds}}
    f["competency_ratings"] = {"round_id": {"$in": rounds}}
    return f


def create():
    db = _db()
    if db.users.count_documents({"email": {"$regex": E2E_EMAIL_RE}}) or db.leaders.count_documents({"_id": {"$in": list(LEADERS)}}):
        sys.exit("e2e accounts already exist; run cleanup first")
    now = datetime.now(timezone.utc)
    for lid, name in LEADERS.items():
        db.leaders.insert_one({"_id": lid, "name": name, "practice": "E2E", "is_active": True, "created_at": now})
    state = {"created_at": now.isoformat(), "users": {}}
    for key, email, role, leader_id in USERS:
        pw = "E2e-" + secrets.token_urlsafe(16)
        _id = db.users.insert_one({
            "full_name": f"E2E {key}", "email": email, "designation": "E2E",
            "password_hash": bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode(),
            "role": role, "leader_id": leader_id, "is_active": True, "created_at": now, "last_login": None,
            "refresh_token_hashes": [],
        }).inserted_id
        state["users"][key] = {"id": str(_id), "email": email, "password": pw, "role": role, "leader_id": leader_id}
    STATE.write_text(json.dumps(state, indent=1))
    print(f"created leaders {list(LEADERS)} and users {[u[1] for u in USERS]}; credentials in {STATE.name} (gitignored)")


def report(delete=False):
    db = _db()
    total = 0
    for coll, flt in _filters(db).items():
        n = db[coll].count_documents(flt)
        if n:
            print(f"  {coll:26s} {n}")
            total += n
            if delete:
                db[coll].delete_many(flt)
    print(f"{'deleted' if delete else 'would delete'} {total} e2e document(s)")
    if delete and STATE.exists():
        STATE.unlink()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    {"create": create, "report": lambda: report(False), "cleanup": lambda: report(True)}.get(cmd, lambda: sys.exit(__doc__))()
