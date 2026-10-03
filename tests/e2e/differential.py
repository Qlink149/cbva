"""Phase B: old backend vs current backend, same database, same SECRET_KEY, every GET route x role.

    E2E_SECRET_KEY=... OLD_URL=http://127.0.0.1:8101 NEW_URL=http://127.0.0.1:8102 \
    E2E_MONGODB_URL=... E2E_DATABASE_NAME=cbva_verify python tests/e2e/differential.py out.json

Tokens are minted locally with the shared SECRET_KEY for temporary e2e users (provision.py). Requests are sent
old-then-new for each case so both servers see the same data. Volatile fields (timestamps written by the GET
itself) are normalised before comparing. The diff user is bound to the real leader DIFF_LEADER (read access only).
"""
import json
import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(__file__))
from provision import _db  # noqa: E402  (same database-name guard)

OLD, NEW = os.environ["OLD_URL"], os.environ["NEW_URL"]
SECRET = os.environ["E2E_SECRET_KEY"]
LEADER = os.environ.get("DIFF_LEADER", "manan")
OTHER = os.environ.get("DIFF_OTHER_LEADER", "varun")
VOLATILE = re.compile(r"(updated_at|generated_at|server_time|as_of_ts|request_id)$")


def mint(user):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user["_id"]), "role": user["role"], "leader_id": user.get("leader_id"),
                       "exp": now + timedelta(minutes=30), "type": "access", "jti": uuid.uuid4().hex}, SECRET, "HS256")


def norm(x, path=""):
    if isinstance(x, dict):
        return {k: ("<volatile>" if VOLATILE.search(k) else norm(v, f"{path}.{k}")) for k, v in sorted(x.items())}
    if isinstance(x, list):
        return [norm(v, path) for v in x]
    return x


def diff_paths(a, b, path="$", out=None, limit=12):
    out = [] if out is None else out
    if len(out) >= limit:
        return out
    if type(a) is not type(b):
        out.append(f"{path}: {type(a).__name__} vs {type(b).__name__}")
    elif isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f"{path}.{k}: {'missing in old' if k not in a else 'missing in new'}")
            else:
                diff_paths(a[k], b[k], f"{path}.{k}", out, limit)
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append(f"{path}: len {len(a)} vs {len(b)}")
        for i, (p, q) in enumerate(zip(a, b)):
            diff_paths(p, q, f"{path}[{i}]", out, limit)
    elif a != b:
        out.append(f"{path}: {str(a)[:60]!r} vs {str(b)[:60]!r}")
    return out


def cases(db):
    eng = db.engagements.find_one({"leader_id": LEADER}, {"_id": 1})
    rnd = db.appraisal_rounds.find_one({"leader_id": LEADER}, {"_id": 1})
    base = []
    for fy in ("2627", "2526"):
        q = {"leader_id": LEADER, "fiscal_year": fy}
        for p in ("actions/", "additional-work/", "appraisals/rounds", "appraisals/scorecard", "bluesky/", "client-meetings/",
                  "collection-transactions/", "collections/", "el-summary/", "engagement-actions/", "engagements/",
                  "headcount/", "hiring/", "new-clients/", "pipeline/", "pipeline/fy-actuals", "team/", "tasks/",
                  "assessments/", "admin/plans", "kra/resolved"):
            base.append((f"/api/{p}", q))
        base.append(("/api/engagement-actions", q))              # second registered spelling
        base.append(("/api/actions/", {"leader_id": OTHER, "fiscal_year": fy}))   # cross-leader (403 for the user)
        base.append(("/api/engagements/", {"leader_id": OTHER, "fiscal_year": fy}))
        for p in ("firmwide/clients", "firmwide/dashboard-aggregate", "firmwide/leaders", "firmwide/summary", "firmwide/team",
                  "consolidated-summary/"):
            base.append((f"/api/{p}", {"fiscal_year": fy}))
        for layer in ("fy", "leader"):
            for p in ("kra/kpis", "kra/weights", "kra/competencies"):
                base.append((f"/api/{p}", {"layer": layer, "fiscal_year": fy, **({"leader_id": LEADER} if layer == "leader" else {})}))
    base += [("/api/admin/clients", {}), ("/api/admin/engagement-types", {}), ("/api/admin/financial-years", {}),
             ("/api/admin/settings", {}), ("/api/admin/users", {}), ("/api/audit-log/", {"limit": 50}),
             ("/api/audit-log/export", {"entity_type": "engagement", "leader_id": LEADER}),
             ("/api/auth/me", {}), ("/api/baselines/", {}), ("/api/baselines/", {"leader_id": LEADER}),
             ("/api/financial-years/", {}), ("/api/kra/categories", {}), ("/api/leaders/", {}),
             (f"/api/leaders/{LEADER}", {}), (f"/api/leaders/{OTHER}", {}), ("/api/kra/kpis", {}),
             (f"/api/engagements/{eng['_id']}/changes", {}), (f"/api/appraisals/rounds/{rnd['_id']}", {}),
             (f"/api/audit-log/entity/engagement/{eng['_id']}", {}), ("/health", {}), ("/health/ready", {})]
    return base


def main(out_path):
    db = _db()
    users = {
        "admin": db.users.find_one({"email": "e2e-admin@example.com"}),
        "management": db.users.find_one({"email": "e2e-management@example.com"}),
        "user": db.users.find_one({"email": "e2e-diff-leader@example.com"}),
    }
    if not users["user"]:   # read-only user bound to a real leader, removed by provision.py cleanup (e2e-* email)
        _id = db.users.insert_one({"full_name": "E2E diff", "email": "e2e-diff-leader@example.com", "password_hash": "!",
                                   "role": "user", "leader_id": LEADER, "is_active": True, "refresh_token_hashes": [],
                                   "created_at": datetime.now(timezone.utc)}).inserted_id
        users["user"] = db.users.find_one({"_id": _id})
    headers = {r: {"Authorization": "Bearer " + mint(u)} for r, u in users.items()}
    headers["unauth"] = {}
    results, summary = [], {"same": 0, "status_diff": 0, "body_diff": 0}
    with httpx.Client(timeout=60) as c:
        for path, params in cases(db):
            for role, h in headers.items():
                ro = c.get(OLD + path, params=params, headers=h)
                rn = c.get(NEW + path, params=params, headers=h)
                rec = {"path": path, "params": params, "role": role, "old": ro.status_code, "new": rn.status_code}
                if ro.status_code != rn.status_code:
                    rec["verdict"] = "STATUS"
                    rec["old_body"], rec["new_body"] = ro.text[:300], rn.text[:300]
                    summary["status_diff"] += 1
                else:
                    try:
                        a, b = norm(ro.json()), norm(rn.json())
                    except ValueError:
                        a, b = ro.text, rn.text
                    d = diff_paths(a, b) if a != b else []
                    rec["verdict"] = "BODY" if d else "SAME"
                    if d:
                        rec["diff"] = d
                    summary["body_diff" if d else "same"] += 1
                results.append(rec)
    json.dump({"summary": summary, "results": results}, open(out_path, "w"), indent=1)
    print(summary)
    for r in results:
        if r["verdict"] != "SAME":
            print(f"{r['verdict']:6s} {r['role']:10s} {r['path']} {r['params']} old={r['old']} new={r['new']}",
                  (r.get("diff") or [r.get("old_body", "")[:120], r.get("new_body", "")[:120]])[:4])


if __name__ == "__main__":
    main(sys.argv[1])
