"""python -m app.cli: bootstrap, check-demo-users, verify-indexes, compare-counts."""
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app import cli
from app.core import database
from app.core.config import settings

OWNED = ["users", "financial_years", "kra_categories", "kpi_definitions", "kra_weight_config",
         "leadership_competencies", "leaders", "audit_log"]


async def _wipe():
    await database.connect_db()
    for c in OWNED:
        await database.db[c].delete_many({})
    await database.close_db()


@pytest_asyncio.fixture
async def clean_db():
    await _wipe()
    yield
    await _wipe()


@pytest.mark.asyncio
async def test_bootstrap_rejects_short_or_missing_password(clean_db, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "ops@example.com")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "short")
    assert await cli.bootstrap() == 2
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", None)
    assert await cli.bootstrap() == 2
    await database.connect_db()
    assert await database.db.users.count_documents({}) == 0
    await database.close_db()


@pytest.mark.asyncio
async def test_bootstrap_is_idempotent_and_login_works(clean_db, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "Ops@Example.com")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "correct-horse-battery")
    assert await cli.bootstrap() == 0
    # change the env password: an existing admin must NOT be overwritten
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "a-different-long-password")
    assert await cli.bootstrap() == 0

    await database.connect_db()
    users = await database.db.users.find({}).to_list(10)
    assert len(users) == 1 and users[0]["email"] == "ops@example.com" and users[0]["role"] == "admin"
    from app.core.security import verify_password
    assert verify_password("correct-horse-battery", users[0]["password_hash"])
    assert await database.db.kra_categories.count_documents({}) > 0
    assert await database.db.financial_years.count_documents({"is_current": True}) == 1
    assert await database.db.financial_years.count_documents({}) == 1
    await database.close_db()


@pytest.mark.asyncio
async def test_check_demo_users_read_only_then_deactivate(clean_db):
    await database.connect_db()
    for e in ("admin@cbva.com", "mm@cbva.com", "vc@cbva.com", "real.person@firm.com"):
        await database.db.users.insert_one({"email": e, "role": "user", "is_active": True, "refresh_token_hashes": ["a", "b"]})
    await database.close_db()

    assert await cli.check_demo_users(deactivate=False) == 1
    await database.connect_db()
    assert await database.db.users.count_documents({"is_active": True}) == 4  # untouched
    await database.close_db()

    assert await cli.check_demo_users(deactivate=True) == 0
    await database.connect_db()
    state = {u["email"]: (u["is_active"], u["refresh_token_hashes"]) async for u in database.db.users.find({})}
    await database.close_db()
    for e in ("admin@cbva.com", "mm@cbva.com", "vc@cbva.com"):
        assert state[e] == (False, [])
    assert state["real.person@firm.com"] == (True, ["a", "b"])


@pytest.mark.asyncio
async def test_check_demo_users_clean_db_returns_zero(clean_db):
    assert await cli.check_demo_users(deactivate=False) == 0


@pytest.mark.asyncio
async def test_verify_indexes_detects_missing_index(clean_db):
    await database.connect_db()  # creates every index
    await database.close_db()
    assert await cli.verify_indexes(create=False) == 0

    await database.connect_db()
    await database.db.users.drop_index("email_1")
    await database.close_db()
    assert await cli.verify_indexes(create=False) == 1
    assert await cli.verify_indexes(create=True) == 0
    assert await cli.verify_indexes(create=False) == 0


@pytest.mark.asyncio
async def test_compare_counts(clean_db):
    await database.connect_db()
    await database.db.users.insert_one({"email": "x@y.z"})
    await database.close_db()
    # same DB as source and target -> equal
    assert await cli.compare_counts(settings.MONGODB_URL, settings.DATABASE_NAME, ["users"]) == 0
    # a different source DB with a different count -> diff
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await client["cbva_test_other"].users.insert_many([{"email": "a"}, {"email": "b"}])
    try:
        assert await cli.compare_counts(settings.MONGODB_URL, "cbva_test_other", ["users"]) == 1
    finally:
        await client.drop_database("cbva_test_other")
        client.close()
