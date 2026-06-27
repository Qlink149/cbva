from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from loguru import logger
import os
import sys

from app.core.config import settings
from app.core.database import connect_db, close_db, ensure_db_connected
from app.core.limiter import limiter
from app.routers import (
    auth,
    leaders,
    engagements,
    pipeline,
    bluesky,
    collections,
    actions,
    tasks,
    team,
    hiring,
    baselines,
    el_summary,
    firmwide,
    admin,
    assessments,
    financial_years,
    client_meetings,
)


logger.remove()
logger.add(sys.stderr, level="INFO", format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")

from slowapi import _rate_limit_exceeded_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="CBVA API",
    version="1.0.0",
    description="CBV & Associates LLP Business Planning Platform",
    **({} if os.getenv("VERCEL") else {"lifespan": lifespan}),
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def ensure_db_middleware(request: Request, call_next):
    await ensure_db_connected()
    return await call_next(request)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    if response.status_code >= 400:
        logger.warning("{} {} -> {}", request.method, request.url.path, response.status_code)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",         tags=["Auth"])
app.include_router(leaders.router,     prefix="/api/leaders",      tags=["Leaders"])
app.include_router(engagements.router, prefix="/api/engagements",  tags=["Engagements"])
app.include_router(pipeline.router,    prefix="/api/pipeline",     tags=["Pipeline"])
app.include_router(bluesky.router,     prefix="/api/bluesky",      tags=["BlueSky"])
app.include_router(collections.router, prefix="/api/collections",  tags=["Collections"])
app.include_router(actions.router,     prefix="/api/actions",      tags=["Actions"])
app.include_router(tasks.router,       prefix="/api/tasks",        tags=["Tasks"])
app.include_router(team.router,        prefix="/api/team",         tags=["Team"])
app.include_router(hiring.router,      prefix="/api/hiring",       tags=["Hiring"])
app.include_router(baselines.router,   prefix="/api/baselines",    tags=["Baselines"])
app.include_router(el_summary.router,  prefix="/api/el-summary",   tags=["ELSummary"])
app.include_router(financial_years.router, prefix="/api/financial-years", tags=["FinancialYears"])
app.include_router(client_meetings.router, prefix="/api/client-meetings", tags=["ClientMeetings"])
app.include_router(assessments.router, prefix="/api/assessments",  tags=["Assessments"])
app.include_router(firmwide.router,    prefix="/api/firmwide",     tags=["Firmwide"])
app.include_router(admin.router,       prefix="/api/admin",        tags=["Admin"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
