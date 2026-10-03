import asyncio
import time

from loguru import logger
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

_client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


_INDEX_RETRIES = 3
_INDEX_RECHECK_SECONDS = 30.0
_indexes_ready = False
_last_index_attempt = 0.0


async def _create_indexes_with_retry(retries: int = _INDEX_RETRIES) -> bool:
    """Retry index creation with exponential backoff (1s, 2s). Never raises."""
    global _indexes_ready, _last_index_attempt
    _last_index_attempt = time.monotonic()
    for attempt in range(1, retries + 1):
        try:
            await _create_indexes()
            _indexes_ready = True
            logger.info("MongoDB connected and indexes ensured.")
            return True
        except Exception as exc:
            if attempt == retries:
                logger.error("Index creation failed after {} attempts; will retry on a later request: {}", attempt, exc)
                return False
            delay = 2 ** (attempt - 1)
            logger.warning("Index creation attempt {}/{} failed ({}); retrying in {}s", attempt, _INDEX_RETRIES, exc, delay)
            await asyncio.sleep(delay)
    return False


async def connect_db() -> None:
    global _client, db
    if db is not None:
        return
    _client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=30000,
        maxPoolSize=10,
        minPoolSize=1,
        maxIdleTimeMS=60000,
        retryWrites=True,
    )
    db = _client[settings.DATABASE_NAME]
    await _create_indexes_with_retry()


_fy_synced = False


async def ensure_db_connected() -> None:
    """Idempotent connect — used by Vercel serverless when lifespan may not run."""
    global _fy_synced
    if db is None:
        await connect_db()
    elif not _indexes_ready and time.monotonic() - _last_index_attempt > _INDEX_RECHECK_SECONDS:
        # Single attempt, rate-limited: never stall requests behind a backoff loop.
        await _create_indexes_with_retry(retries=1)
    if not _fy_synced and db is not None:
        try:
            from app.services.fiscal_year import ensure_current_fy_matches_calendar
            await ensure_current_fy_matches_calendar()
            _fy_synced = True
        except Exception as exc:
            logger.warning("FY calendar sync skipped: %s", exc)


async def close_db() -> None:
    global _client, db, _indexes_ready
    if _client:
        _client.close()
    _client = None
    db = None
    _indexes_ready = False


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
    await db.additional_work.create_index([("leader_id", 1), ("fiscal_year", 1), ("month_key", 1)])
    await db.additional_work.create_index([("leader_id", 1), ("fiscal_year", 1), ("engagement_id", 1)])
    await db.engagement_change_log.create_index([("engagement_id", 1), ("changed_at", -1)])
    await db.engagement_actions.create_index([("leader_id", 1), ("fiscal_year", 1), ("engagement_id", 1)])
    await db.collection_transactions.create_index([("leader_id", 1), ("fiscal_year", 1), ("month", 1)])
    await db.collection_transactions.create_index("engagement_id")
    await db.consolidated_summaries.create_index("report_fy", unique=True)
    await db.audit_log.create_index([("created_at", -1)])
    await db.audit_log.create_index([("entity_type", 1), ("entity_id", 1), ("created_at", -1)])
    await db.audit_log.create_index([("actor_id", 1), ("created_at", -1)])
    await db.audit_log.create_index([("leader_id", 1), ("fiscal_year", 1), ("created_at", -1)])
    await db.kra_categories.create_index("sort_order")
    try:
        await db.kra_weight_config.drop_index("fiscal_year_1_leader_id_1_category_id_1")
    except Exception:
        pass
    await db.kra_weight_config.create_index(
        [("layer", 1), ("fiscal_year", 1), ("leader_id", 1), ("category_id", 1)],
        unique=True,
    )
    await db.kpi_definitions.create_index(
        [("layer", 1), ("fiscal_year", 1), ("leader_id", 1), ("sort_order", 1)]
    )
    await db.leadership_competencies.create_index(
        [("layer", 1), ("fiscal_year", 1), ("leader_id", 1), ("sort_order", 1)]
    )
    await db.appraisal_rounds.create_index(
        [("fiscal_year", 1), ("leader_id", 1), ("round_type", 1)],
        unique=True,
    )
    await db.kpi_ratings.create_index([("round_id", 1), ("kpi_definition_id", 1)], unique=True)
    await db.competency_ratings.create_index([("round_id", 1), ("competency_id", 1)], unique=True)
