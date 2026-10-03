"""Route + frontend-call inventory (phase A). Read-only: imports the app (no DB connection) and scans frontend/src.

    python tests/e2e/inventory.py [--json out.json] [--md out.md]

Run with backend/ on PYTHONPATH and a dummy SECRET_KEY; no database is contacted.
"""
import ast
import inspect
import json
import os
import re
import sys
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("ENV", "prod")          # inventory the app as deployed (no /docs, /openapi.json)
os.environ.setdefault("SECRET_KEY", "inventory-only-not-a-secret-" + "x" * 32)

from app.main import app  # noqa: E402
from app.dependencies.auth import get_current_user  # noqa: E402

PUBLIC = {"/health", "/health/ready"}


def _walk(routes):
    for r in routes:
        if hasattr(r, "effective_route_contexts"):
            yield from r.effective_route_contexts()
        elif getattr(r, "methods", None):
            yield r


def _deps(dependant):
    yield dependant
    for d in dependant.dependencies:
        yield from _deps(d)


def _auth(route):
    roles, authed = None, False
    if not hasattr(route, "dependant"):   # plain Starlette route (health probes)
        return False, None
    for d in _deps(route.dependant):
        fn = d.call
        if fn is get_current_user:
            authed = True
        if fn is not None and getattr(fn, "__qualname__", "").startswith("require_roles"):
            cells = dict(zip(fn.__code__.co_freevars, (c.cell_contents for c in fn.__closure__ or ())))
            roles = sorted(cells.get("roles", ()))
    return authed, roles


def _scope_calls(fn):
    try:
        tree = ast.parse(textwrap.dedent(inspect.getsource(fn)))
    except (OSError, TypeError):
        return []
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            f = node.func
            n = f.id if isinstance(f, ast.Name) else getattr(f, "attr", "")
            if n.startswith("enforce_leader") or n.startswith("_assert") or "scope" in n:
                names.add(n)
    return sorted(names)


def backend_routes():
    out = []
    for r in _walk(app.routes):
        for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
            authed, roles = _auth(r)
            out.append({
                "method": m, "path": r.path,
                "auth": "public" if not authed else ("roles:" + ",".join(roles) if roles else "any-user"),
                "leader_scope": _scope_calls(r.endpoint),
                "endpoint": f"{r.endpoint.__module__.replace('app.routers.', '')}.{r.endpoint.__name__}",
            })
    out.sort(key=lambda x: (x["path"], x["method"]))
    return out


CALL_RE = re.compile(r"api(Get|Post|Put|Patch|Delete)\(\s*([`'\"])(.*?)\2", re.S)


def _norm_front(raw):
    p = raw.split("?")[0]
    p = re.sub(r"\$\{[^}]*\}", "{x}", p)
    return p


def frontend_calls():
    out = []
    for f in sorted((ROOT / "frontend" / "src").rglob("*.js*")):
        text = f.read_text(encoding="utf-8")
        for mt in CALL_RE.finditer(text):
            line = text.count("\n", 0, mt.start()) + 1
            out.append({"method": mt.group(1).upper(), "raw": mt.group(3), "path": _norm_front(mt.group(3)),
                        "file": f.relative_to(ROOT).as_posix(), "line": line})
    # the two calls that bypass the helpers
    for rel, pat, meth in (("frontend/src/api/client.js", "/api/auth/refresh", "POST"),
                           ("frontend/src/hooks/useAuditLog.js", "/api/audit-log/export", "GET")):
        text = (ROOT / rel).read_text(encoding="utf-8")
        i = text.find(pat)
        if i >= 0:
            out.append({"method": meth, "raw": pat, "path": pat, "file": rel, "line": text.count("\n", 0, i) + 1})
    return out


def _route_regex(path):
    return re.compile("^" + re.sub(r"\\\{[^}]+\\\}", "[^/]+", re.escape(path.rstrip("/"))) + "/?$")


def match(front, routes):
    """Exact (incl. slash) / slash-only (served by the normalizer) / method-mismatch / none."""
    fp = front["path"]
    cand = [r for r in routes if _route_regex(r["path"]).match(re.sub(r"\{x\}", "X", fp))]
    # a literal segment beats a parameter: prefer routes with fewer {params}
    cand.sort(key=lambda r: r["path"].count("{"))
    same_method = [r for r in cand if r["method"] == front["method"]]
    if not same_method:
        return ("METHOD-MISMATCH" if cand else "NO-ROUTE"), (cand[0] if cand else None)
    r = same_method[0]
    exact = fp.endswith("/") == r["path"].endswith("/")
    return ("OK" if exact else "SLASH (normalizer)"), r


def main():
    routes = backend_routes()
    calls = frontend_calls()
    for c in calls:
        status, r = match(c, routes)
        c["status"], c["route"] = status, (f"{r['method']} {r['path']}" if r else None)
    used = {c["route"] for c in calls if c["route"] and c["status"] in ("OK", "SLASH (normalizer)")}
    for r in routes:
        r["used_by_frontend"] = f"{r['method']} {r['path']}" in used
    data = {"routes": routes, "calls": calls}
    args = sys.argv[1:]
    if "--json" in args:
        Path(args[args.index("--json") + 1]).write_text(json.dumps(data, indent=1))
    if "--md" in args:
        lines = ["| # | Method | Path | Auth | Leader scope | Handler | Frontend |", "|---|---|---|---|---|---|---|"]
        for i, r in enumerate(routes, 1):
            lines.append(f"| {i} | {r['method']} | `{r['path']}` | {r['auth']} | {', '.join(r['leader_scope']) or '-'} | "
                         f"{r['endpoint']} | {'yes' if r['used_by_frontend'] else '-'} |")
        lines += ["", "| # | Method | Frontend path | file:line | Backend route | Match |", "|---|---|---|---|---|---|"]
        for i, c in enumerate(calls, 1):
            lines.append(f"| {i} | {c['method']} | `{c['raw']}` | {c['file']}:{c['line']} | {c['route'] or '-'} | {c['status']} |")
        Path(args[args.index("--md") + 1]).write_text("\n".join(lines) + "\n", encoding="utf-8")
    from collections import Counter
    print("routes:", len(routes), Counter(r["auth"] for r in routes).most_common())
    print("frontend calls:", len(calls), Counter(c["status"] for c in calls))
    print("routes used by frontend:", sum(r["used_by_frontend"] for r in routes))
    for c in calls:
        if c["status"] not in ("OK", "SLASH (normalizer)"):
            print("  !!", c["status"], c["method"], c["raw"], f"{c['file']}:{c['line']}", "->", c["route"])


if __name__ == "__main__":
    main()
