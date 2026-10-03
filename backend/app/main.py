from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError
from loguru import logger
import asyncio
import os
import sys

from app.core.config import settings
from app.core.database import connect_db, close_db, ensure_db_connected
from app.services.audit_service import request_id_ctx
from app.core.limiter import limiter, client_ip
from app.core.proxy import TrailingSlashNormalizerMiddleware, TrustedProxySchemeMiddleware
from app.routers import (
    auth,
    leaders,
    engagements,
    engagement_actions,
    pipeline,
    bluesky,
    collections,
    collection_transactions,
    actions,
    tasks,
    team,
    hiring,
    headcount,
    baselines,
    el_summary,
    firmwide,
    admin,
    assessments,
    financial_years,
    client_meetings,
    additional_work,
    new_clients,
    consolidated,
    audit,
    kra,
    appraisals,
)


logger.remove()
logger.add(sys.stderr, level="INFO", format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")

from slowapi import _rate_limit_exceeded_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    try:
        from app.services.fiscal_year import ensure_current_fy_matches_calendar
        await ensure_current_fy_matches_calendar()
    except Exception as exc:
        logger.warning(f"FY calendar sync skipped: {exc}")
    yield
    await close_db()


_app_kwargs: dict = {} if os.getenv("VERCEL") else {"lifespan": lifespan}
if settings.is_prod:
    # No public API docs / schema in production.
    _app_kwargs.update(docs_url=None, redoc_url=None, openapi_url=None)

app = FastAPI(
    title="CBVA API",
    version="1.0.0",
    description="CBV & Associates LLP Business Planning Platform",
    # No trailing-slash redirects: behind Caddy they pointed at http:// and broke the frontend. Both spellings
    # are served directly by TrailingSlashNormalizerMiddleware below.
    redirect_slashes=False,
    **_app_kwargs,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(InvalidId)
async def _invalid_object_id(request: Request, exc: InvalidId):
    # Handlers call ObjectId(path_id) directly; a malformed id is bad input, not a server error.
    return JSONResponse(status_code=422, content={"detail": "Invalid id"})


@app.exception_handler(DuplicateKeyError)
async def _duplicate_key(request: Request, exc: DuplicateKeyError):
    # A unique index rejected the write (e.g. a second baseline for the same leader + FY, or a create race).
    return JSONResponse(status_code=409, content={"detail": "A record with these values already exists"})


@app.middleware("http")
async def audit_request_id_middleware(request: Request, call_next):
    token = request_id_ctx.set(uuid4().hex)
    try:
        return await call_next(request)
    finally:
        request_id_ctx.reset(token)


@app.middleware("http")
async def ensure_db_middleware(request: Request, call_next):
    if not request.url.path.startswith("/health"):
        await ensure_db_connected()
    return await call_next(request)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    if response.status_code >= 400:
        logger.warning("{} {} -> {} ip={}", request.method, request.url.path, response.status_code, client_ip(request))
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    # Auth is a Bearer header (no cookies, axios has no withCredentials) -> credentials not needed.
    allow_credentials=False,
    # PATCH is used by actions / engagements remarks / engagement-actions routers.
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
# Added last = outermost: the scheme is fixed before anything else runs, then the path is normalised.
app.add_middleware(TrailingSlashNormalizerMiddleware, router=app.router)
app.add_middleware(TrustedProxySchemeMiddleware)

app.include_router(auth.router,        prefix="/api/auth",         tags=["Auth"])
app.include_router(leaders.router,     prefix="/api/leaders",      tags=["Leaders"])
app.include_router(engagements.router, prefix="/api/engagements",  tags=["Engagements"])
app.include_router(engagement_actions.router, prefix="/api/engagement-actions", tags=["EngagementActions"])
app.include_router(pipeline.router,    prefix="/api/pipeline",     tags=["Pipeline"])
app.include_router(bluesky.router,     prefix="/api/bluesky",      tags=["BlueSky"])
app.include_router(collections.router,             prefix="/api/collections",             tags=["Collections"])
app.include_router(collection_transactions.router, prefix="/api/collection-transactions", tags=["CollectionTransactions"])
app.include_router(actions.router,     prefix="/api/actions",      tags=["Actions"])
app.include_router(tasks.router,       prefix="/api/tasks",        tags=["Tasks"])
app.include_router(team.router,        prefix="/api/team",         tags=["Team"])
app.include_router(hiring.router,      prefix="/api/hiring",       tags=["Hiring"])
app.include_router(headcount.router,   prefix="/api/headcount",    tags=["Headcount"])
app.include_router(baselines.router,   prefix="/api/baselines",    tags=["Baselines"])
app.include_router(el_summary.router,  prefix="/api/el-summary",   tags=["ELSummary"])
app.include_router(financial_years.router, prefix="/api/financial-years", tags=["FinancialYears"])
app.include_router(client_meetings.router, prefix="/api/client-meetings", tags=["ClientMeetings"])
app.include_router(additional_work.router, prefix="/api/additional-work", tags=["AdditionalWork"])
app.include_router(new_clients.router, prefix="/api/new-clients", tags=["NewClients"])
app.include_router(assessments.router, prefix="/api/assessments",  tags=["Assessments"])
app.include_router(firmwide.router,    prefix="/api/firmwide",     tags=["Firmwide"])
app.include_router(consolidated.router, prefix="/api/consolidated-summary", tags=["Consolidated"])
app.include_router(admin.router,       prefix="/api/admin",        tags=["Admin"])
app.include_router(audit.router,       prefix="/api/audit-log",    tags=["AuditLog"])
app.include_router(kra.router,         prefix="/api/kra",          tags=["KRA"])
app.include_router(appraisals.router,  prefix="/api/appraisals",   tags=["Appraisals"])


@app.get("/health")
async def health():
    """Liveness: process is up. Does not touch Mongo."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/health/ready")
async def health_ready():
    """Readiness: Mongo answers a ping within 2s, else 503."""
    from app.core import database

    try:
        if database.db is None:
            await asyncio.wait_for(database.connect_db(), timeout=8)
        await asyncio.wait_for(database.db.command("ping"), timeout=2)
    except Exception as exc:
        logger.warning("Readiness check failed: {}", exc)
        return JSONResponse(status_code=503, content={"status": "unavailable", "db": "down"})
    return {"status": "ok", "db": "up", "version": "1.0.0"}
