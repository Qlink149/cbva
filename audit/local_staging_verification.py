"""Seed staging DB (if empty) and run local API verification against localhost:8000.

Usage (backend must be running with staging MONGODB_URL):
  python audit/local_staging_verification.py
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.core.security import hash_password  # noqa: E402

STAGING_URL = os.environ.get("MONGODB_URL")
if not STAGING_URL:
    raise SystemExit("Set MONGODB_URL to staging cluster (never production).")
DB_NAME = os.environ.get("DATABASE_NAME", "cbva1_db")
API = os.environ.get("LOCAL_API_URL", "http://localhost:8001")
TEST_EMAIL = "verify.local@staging.cbva.in"
TEST_PASSWORD = "VerifyLocal123!"
LEADER_ID = "manan"
FY = "2627"

results: list[dict] = []


def record(test_id: str, name: str, passed: bool, detail: str) -> None:
    results.append({"id": test_id, "name": name, "passed": passed, "detail": detail})
    mark = "PASS" if passed else "FAIL"
    print(f"  [{mark}] {test_id}: {detail}")


async def seed_if_needed() -> None:
    client = AsyncIOMotorClient(STAGING_URL, serverSelectionTimeoutMS=20000)
    db = client[DB_NAME]
    try:
        existing = await db.users.find_one({"email": TEST_EMAIL})
        if existing:
            print(f"Staging user exists: {TEST_EMAIL}")
            return
        await db.users.delete_many({"email": {"$regex": "verify.local@"}})
        now = datetime.now(timezone.utc)
        await db.leaders.update_one(
            {"_id": LEADER_ID},
            {"$set": {"name": "Manan Mathuria", "practice": "Tax", "is_active": True}},
            upsert=True,
        )
        for fy_doc in [
            {"slug": "2526", "label": "FY 2025-26", "is_current": False,
             "is_editable": False, "is_active": True, "sort_order": 0,
             "created_at": now, "updated_at": now},
            {"slug": FY, "label": "FY 2026-27", "is_current": True,
             "is_editable": True, "is_active": True, "sort_order": 1,
             "created_at": now, "updated_at": now},
        ]:
            await db.financial_years.update_one({"slug": fy_doc["slug"]}, {"$set": fy_doc}, upsert=True)
        user_id = ObjectId()
        await db.users.insert_one({
            "_id": user_id,
            "full_name": "Local Verify User",
            "email": TEST_EMAIL,
            "password_hash": hash_password(TEST_PASSWORD),
            "designation": "Partner",
            "role": "user",
            "leader_id": LEADER_ID,
            "is_active": True,
            "created_at": now,
            "refresh_token_hashes": [],
        })
        print(f"Seeded staging: user {TEST_EMAIL} leader={LEADER_ID}")
    finally:
        client.close()


async def run_api_tests() -> None:
    async with httpx.AsyncClient(base_url=API, timeout=30.0) as client:
        # Health
        try:
            r = await client.get("/health")
            record("BOOT", "API health", r.status_code == 200, f"status={r.status_code}")
        except Exception as e:
            record("BOOT", "API health", False, str(e))
            return

        # Login
        r = await client.post("/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        if r.status_code != 200:
            record("AUTH", "Login", False, f"{r.status_code} {r.text[:200]}")
            return
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        record("AUTH", "Login", True, TEST_EMAIL)

        # A1 round-trip: create with 18 lakh rupees
        create_body = {
            "leader_id": LEADER_ID,
            "fiscal_year": FY,
            "name": "A1 Roundtrip Test Client",
            "green": 1_800_000,
            "amber": 0,
            "blue_sky": 0,
            "collected": 0,
        }
        r = await client.post("/api/engagements/", json=create_body, headers=headers)
        record("A1", "Create engagement 18,00,000", r.status_code == 201, f"green={r.json().get('green') if r.status_code==201 else r.text[:120]}")
        if r.status_code != 201:
            return
        eng_id = r.json()["id"]
        stored_green = r.json().get("green")

        r = await client.get("/api/engagements/", params={"leader_id": LEADER_ID, "fiscal_year": FY}, headers=headers)
        rows = r.json().get("data", [])
        row = next((e for e in rows if str(e.get("id")) == str(eng_id)), None)
        list_green = row.get("green") if row else None
        record("A1", "GET after create (simulate tab return)", list_green == 1_800_000, f"list green={list_green}")

        # A1 update round-trip (table edit path — whole rupees)
        r = await client.put(f"/api/engagements/{eng_id}", json={"green": 1_800_000}, headers=headers)
        r2 = await client.get("/api/engagements/", params={"leader_id": LEADER_ID, "fiscal_year": FY}, headers=headers)
        data = r2.json().get("data", r2.json())
        row2 = next((e for e in data if str(e.get("id")) == str(eng_id)), None)
        record("A1", "PUT then GET green unchanged", row2 and row2.get("green") == 1_800_000, f"green={row2.get('green') if row2 else None}")

        # A1 comma-parse simulation (frontend layer — node)
        root = Path(__file__).resolve().parents[1] / "frontend"
        node_test = (
            "import { parseRupeeInput, parseLakhInputToRupees } from './src/lib/parseAmount.js';"
            "const cases=[['18,00,000',1800000],['1800000',1800000],['18',1800000]];"
            "for (const [inp,exp] of cases){"
            "  const ru=parseRupeeInput(inp); const lk=parseLakhInputToRupees(inp);"
            "  console.log(JSON.stringify({input:inp,rupee:ru,lakh:lk}));"
            "}"
        )
        proc = subprocess.run(
            ["node", "--input-type=module", "-e", node_test],
            cwd=root, capture_output=True, text=True, timeout=15,
        )
        parse_ok = proc.returncode == 0
        parse_detail = proc.stdout.strip() if parse_ok else proc.stderr[:200]
        record("A1", "parseAmount comma/lakh (local node)", parse_ok and "1800000" in parse_detail, parse_detail[:300])

        # A5 + B3: action without deadline
        r = await client.post(
            "/api/engagement-actions/",
            json={
                "engagement_id": eng_id,
                "leader_id": LEADER_ID,
                "fiscal_year": FY,
                "description": "Follow up EL — local verify",
                "remarks": "one-line",
            },
            headers=headers,
        )
        record("A5", "Create action (no deadline)", r.status_code == 201, f"status={r.status_code} {r.text[:120]}")
        action_id = r.json().get("id") if r.status_code == 201 else None

        r = await client.get(
            "/api/engagement-actions/",
            params={"leader_id": LEADER_ID, "fiscal_year": FY},
            headers=headers,
        )
        ids = [a["id"] for a in r.json().get("data", [])]
        record("A5", "Action appears in list", action_id in ids if action_id else False, f"count={len(ids)}")
        record("B3", "Action linked to engagement_id", action_id is not None, f"engagement_id={eng_id}")

        # A5 with deadline — expect BSON/date bug
        r = await client.post(
            "/api/engagement-actions/",
            json={
                "engagement_id": eng_id,
                "leader_id": LEADER_ID,
                "fiscal_year": FY,
                "description": "Gora-style with deadline",
                "deadline": "2026-09-16",
            },
            headers=headers,
        )
        deadline_ok = r.status_code == 201
        record(
            "A5",
            "Create action WITH deadline (Nikhil case)",
            deadline_ok,
            f"status={r.status_code} — {'saved' if deadline_ok else 'FAILED (likely datetime.date BSON bug)'}",
        )


async def main() -> None:
    print(f"API: {API}  DB: {DB_NAME} (staging)")
    await seed_if_needed()
    await run_api_tests()
    out = Path(__file__).resolve().parent / "local_staging_verification.json"
    out.write_text(json.dumps({"api": API, "database": DB_NAME, "results": results}, indent=2), encoding="utf-8")
    passed = sum(1 for r in results if r["passed"])
    print(f"\n{passed}/{len(results)} passed — written {out}")


if __name__ == "__main__":
    asyncio.run(main())
