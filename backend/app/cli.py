"""Operations CLI.

    python -m app.cli bootstrap                      # first admin + KRA seed + current FY (idempotent)
    python -m app.cli check-demo-users               # read-only: list demo/seed accounts
    python -m app.cli check-demo-users --deactivate  # also deactivate them and revoke refresh tokens

bootstrap reads ADMIN_EMAIL / ADMIN_PASSWORD from the environment (>= 12 chars).
It never invents leaders: if the `leaders` collection is empty it warns and tells you to load them.
"""
import argparse
import asyncio
import re
import sys
from datetime import datetime, timezone

from loguru import logger

from app.core import database
from app.core.config import settings
from app.core.security import hash_password
from app.services.fiscal_year import calendar_fy_slug

MIN_ADMIN_PASSWORD_LEN = 12

# Accounts created by the old seed scripts (admin@cbva.com, mm@*, vc@*).
DEMO_EMAIL_REGEX = re.compile(r"^(admin@cbva\.com|mm@.*|vc@.*)$", re.IGNORECASE)


def _fy_label(slug: str) -> str:
    return f"FY 20{slug[:2]}-{slug[2:]}"


async def bootstrap() -> int:
    email = (settings.ADMIN_EMAIL or "").strip().lower()
    password = settings.ADMIN_PASSWORD or ""
    if not email or not password:
        print("ERROR: set ADMIN_EMAIL and ADMIN_PASSWORD in the environment.", file=sys.stderr)
        return 2
    if len(password) < MIN_ADMIN_PASSWORD_LEN:
        print(f"ERROR: ADMIN_PASSWORD must be at least {MIN_ADMIN_PASSWORD_LEN} characters.", file=sys.stderr)
        return 2

    await database.connect_db()
    db = database.db
    now = datetime.now(timezone.utc)

    # 1. First admin (idempotent: an existing account is never overwritten).
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"admin: {email} already exists (role={existing.get('role')}, active={existing.get('is_active')}); left unchanged")
    else:
        await db.users.insert_one({
            "full_name": "Administrator",
            "email": email,
            "password_hash": hash_password(password),
            "designation": "Administrator",
            "role": "admin",
            "leader_id": None,
            "is_active": True,
            "created_at": now,
            "last_login": None,
            "refresh_token_hashes": [],
        })
        print(f"admin: created {email}")

    # 2. KRA seed (itself idempotent).
    from app.services import kra_seed
    kra_seed._seeded = False  # re-run even if this process seeded earlier
    await kra_seed.ensure_kra_seed()
    print(f"kra: kra_categories={await db.kra_categories.count_documents({})}")

    # 3. Current FY: create the calendar FY if missing, then align is_current.
    slug = calendar_fy_slug()
    if not await db.financial_years.find_one({"slug": slug}):
        await db.financial_years.insert_one({
            "slug": slug,
            "label": _fy_label(slug),
            "is_current": False,
            "is_active": True,
            "is_editable": True,
            "sort_order": int(slug),
            "created_at": now,
            "updated_at": now,
        })
        print(f"fy: created {slug}")
    from app.services.fiscal_year import ensure_current_fy_matches_calendar
    await ensure_current_fy_matches_calendar()
    current = await db.financial_years.find_one({"is_current": True})
    print(f"fy: current={current['slug'] if current else None}")

    # 4. Leaders: report only.
    leaders = await db.leaders.count_documents({})
    if leaders == 0:
        print(
            "WARNING: `leaders` is empty. Leaders need real names/practices and are not created here; "
            "load them (admin API POST /api/leaders or your seed data) before users can be linked.",
            file=sys.stderr,
        )
    else:
        print(f"leaders: {leaders} present")

    await database.close_db()
    return 0


async def check_demo_users(deactivate: bool) -> int:
    await database.connect_db()
    db = database.db
    found = []
    async for u in db.users.find({}, {"email": 1, "role": 1, "is_active": 1}):
        if DEMO_EMAIL_REGEX.match(u.get("email", "")):
            found.append(u)

    if not found:
        print("OK: no demo accounts (admin@cbva.com, mm@*, vc@*) found.")
        await database.close_db()
        return 0

    for u in found:
        state = "ACTIVE" if u.get("is_active") else "inactive"
        print(f"WARNING: demo account {u['email']} role={u.get('role')} [{state}]")

    if deactivate:
        for u in found:
            await db.users.update_one(
                {"_id": u["_id"]},
                {"$set": {"is_active": False, "refresh_token_hashes": [], "updated_at": datetime.now(timezone.utc)}},
            )
        print(f"Deactivated {len(found)} account(s) and revoked their refresh tokens.")
        rc = 0
    else:
        print("Read-only run. Re-run with --deactivate to disable them (change/rotate passwords if you keep any).")
        rc = 1  # non-zero so CI / scripts notice

    await database.close_db()
    return rc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("bootstrap", help="create first admin, seed KRA, ensure current FY")
    chk = sub.add_parser("check-demo-users", help="list demo accounts (read-only by default)")
    chk.add_argument("--deactivate", action="store_true", help="deactivate matching accounts")
    args = parser.parse_args(argv)

    logger.remove()
    logger.add(sys.stderr, level="WARNING")
    if args.command == "bootstrap":
        return asyncio.run(bootstrap())
    return asyncio.run(check_demo_users(args.deactivate))


if __name__ == "__main__":
    sys.exit(main())
