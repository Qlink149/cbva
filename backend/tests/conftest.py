import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from bson import ObjectId
from datetime import datetime, timezone

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("DATABASE_NAME", "cbva_test")
os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")

from app.main import app
from app.core import database
from app.core.security import hash_password, create_access_token


@pytest_asyncio.fixture
async def client():
    await database.connect_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    if database.db is not None:
        try:
            await database.db.users.delete_many({})
            await database.db.engagements.delete_many({})
            await database.db.leaders.delete_many({})
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


def auth_header(user_id: ObjectId, role: str, leader_id: str | None):
    token = create_access_token(str(user_id), role, leader_id)
    return {"Authorization": f"Bearer {token}"}
