import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from bson import ObjectId
from datetime import datetime, timezone

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-0123456789abcdef")
os.environ.setdefault("DATABASE_NAME", "cbva_test")
os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:5173")
os.environ.setdefault("ENV", "dev")

# Teardown below calls delete_many({}) on real collections: never run against a non-test DB or a remote host.
from tests.db_guard import check_test_database  # noqa: E402

check_test_database(
    os.environ["MONGODB_URL"],
    os.environ["DATABASE_NAME"],
    allow_remote=os.environ.get("ALLOW_REMOTE_TEST_DB") == "1",
)

from app.main import app
from app.core import database
from app.core.security import hash_password, create_access_token


@pytest_asyncio.fixture
async def client():
    await database.connect_db()
    from app.services.kra_seed import ensure_kra_seed
    await ensure_kra_seed()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    if database.db is not None:
        try:
            await database.db.users.delete_many({})
            await database.db.engagements.delete_many({})
            await database.db.leaders.delete_many({})
            await database.db.audit_log.delete_many({})
            await database.db.kra_categories.delete_many({})
            await database.db.kra_weight_config.delete_many({})
            await database.db.kpi_definitions.delete_many({})
            await database.db.leadership_competencies.delete_many({})
            await database.db.appraisal_rounds.delete_many({})
            await database.db.kpi_ratings.delete_many({})
            await database.db.competency_ratings.delete_many({})
            await database.db.financial_years.delete_many({})
            await database.db.engagement_actions.delete_many({})
        except Exception:
            pass
    await database.close_db()


@pytest_asyncio.fixture
async def seed_users():
    now = datetime.now(timezone.utc)
    leader_id = ObjectId()
    user_doc = {
        "_id": leader_id,
        "full_name": "Test Leader",
        "email": "leader@test.com",
        "password_hash": hash_password("password123"),
        "designation": "Partner",
        "role": "user",
        "leader_id": "manan",
        "is_active": True,
        "created_at": now,
        "refresh_token_hashes": [],
    }
    mgmt_doc = {
        "_id": ObjectId(),
        "full_name": "Test Mgmt",
        "email": "mgmt@test.com",
        "password_hash": hash_password("password123"),
        "designation": "Manager",
        "role": "management",
        "leader_id": "varun",
        "is_active": True,
        "created_at": now,
        "refresh_token_hashes": [],
    }
    await database.db.users.insert_one(user_doc)
    await database.db.users.insert_one(mgmt_doc)
    await database.db.leaders.insert_one({"_id": "manan", "name": "Manan", "practice": "Tax", "is_active": True})
    await database.db.leaders.insert_one({"_id": "varun", "name": "Varun", "practice": "TP", "is_active": True})
    return {"user": user_doc, "mgmt": mgmt_doc}


async def seed_editable_fy(slug: str, is_current: bool = False) -> None:
    """Insert an editable financial_years doc. Writes by non-admins are blocked unless the FY is editable."""
    now = datetime.now(timezone.utc)
    await database.db.financial_years.delete_many({"slug": slug})
    await database.db.financial_years.insert_one({
        "slug": slug, "label": f"FY 20{slug[:2]}-{slug[2:]}", "is_current": is_current,
        "is_editable": True, "is_active": True, "sort_order": int(slug),
        "created_at": now, "updated_at": now,
    })


def auth_header(user_id: ObjectId, role: str, leader_id: str | None):
    token = create_access_token(str(user_id), role, leader_id)
    return {"Authorization": f"Bearer {token}"}
