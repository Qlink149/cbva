from loguru import logger
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

_client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    global _client, db
    if db is not None:
        return
    _client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=5000,
    )
    db = _client[settings.DATABASE_NAME]
    try:
        await _create_indexes()
        logger.info("MongoDB connected and indexes ensured.")
    except Exception as exc:
        logger.warning(
            "MongoDB not reachable at startup — indexes skipped. "
            "Make sure MongoDB is running. Error: %s", exc
        )


async def ensure_db_connected() -> None:
    """Idempotent connect — used by Vercel serverless when lifespan may not run."""
    if db is None:
        await connect_db()


async def close_db() -> None:
    if _client:
        _client.close()


async def _create_indexes() -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("leader_id")
    await db.engagements.create_index([("leader_id", 1), ("fiscal_year", 1), ("is_archived", 1)])
    await db.engagements.create_index([("fiscal_year", 1), ("is_archived", 1)])
    await db.engagements.create_index([("fiscal_year", 1), ("el_status", 1)])
    await db.engagements.create_index(
        [("leader_id", 1), ("fiscal_year", 1), ("num", 1)],
        unique=True,
    )
    await db.pipeline_snapshots.create_index([("leader_id", 1), ("fiscal_year", 1), ("sort_order", 1)])
    await db.pipeline_snapshots.create_index(
        [("leader_id", 1), ("fiscal_year", 1), ("label", 1)],
        unique=True,
    )
    await db.blue_sky_entries.create_index([("leader_id", 1), ("fiscal_year", 1), ("sort_order", 1)])
    await db.blue_sky_entries.create_index(
        [("leader_id", 1), ("fiscal_year", 1), ("month", 1)],
        unique=True,
    )
    await db.blue_sky_entries.create_index([("leader_id", 1), ("fiscal_year", 1), ("month_key", 1)])
    await db.collection_entries.create_index([("leader_id", 1), ("fiscal_year", 1), ("sort_order", 1)])
    await db.collection_entries.create_index(
        [("leader_id", 1), ("fiscal_year", 1), ("month", 1)],
        unique=True,
    )
    await db.actions.create_index([("leader_id", 1), ("fiscal_year", 1), ("num", 1)])
    await db.tasks.create_index([("leader_id", 1), ("status", 1), ("deadline", 1)])
    await db.tasks.create_index("created_by_id")
    await db.team_members.create_index([("leader_id", 1), ("fiscal_year", 1), ("status", 1)])
    await db.team_members.create_index([("leader_id", 1), ("fiscal_year", 1), ("is_manager", 1)])
    await db.team_members.create_index([("leader_id", 1), ("fiscal_year", 1), ("sort_order", 1)])
    await db.hiring_requirements.create_index([("leader_id", 1), ("fiscal_year", 1), ("status", 1)])
    await db.headcount_plans.create_index(
        [("leader_id", 1), ("fiscal_year", 1), ("designation", 1)],
        unique=True,
    )
    await db.baseline_plans.create_index([("leader_id", 1), ("financial_year_id", 1)], unique=True)
    await db.el_summaries.create_index(
        [("leader_id", 1), ("fiscal_year", 1)],
        unique=True,
    )
    await db.assessments.create_index([("leader_id", 1), ("fiscal_year", 1), ("sort_order", 1)])
    await db.assessments.create_index("content_hash")
    await db.client_meetings.create_index([("leader_id", 1), ("fiscal_year", 1), ("client_name", 1)])
    await db.engagement_change_log.create_index([("engagement_id", 1), ("changed_at", -1)])
    await db.engagement_actions.create_index([("leader_id", 1), ("fiscal_year", 1), ("engagement_id", 1)])
    await db.collection_transactions.create_index([("leader_id", 1), ("fiscal_year", 1), ("month", 1)])
    await db.collection_transactions.create_index("engagement_id")
    await db.consolidated_summaries.create_index("report_fy", unique=True)
    await db.audit_log.create_index([("created_at", -1)])
    await db.audit_log.create_index([("entity_type", 1), ("entity_id", 1), ("created_at", -1)])
    await db.audit_log.create_index([("actor_id", 1), ("created_at", -1)])
    await db.audit_log.create_index([("leader_id", 1), ("fiscal_year", 1), ("created_at", -1)])
