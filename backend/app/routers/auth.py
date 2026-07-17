from fastapi import APIRouter, HTTPException, Depends, Query, Request
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse, UserPublic
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
)
from app.core import database
from app.dependencies.auth import get_current_user
from app.core.limiter import limiter
from app.services import audit_service
from loguru import logger

router = APIRouter()


def _serialize_user(user: dict) -> UserPublic:
    return UserPublic(
        id=str(user["_id"]),
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
        leader_id=user.get("leader_id"),
        designation=user.get("designation", ""),
    )


async def _store_refresh_token(user_id: ObjectId, refresh_token: str) -> None:
    token_hash = hash_refresh_token(refresh_token)
    await database.db.users.update_one(
        {"_id": user_id},
        {"$push": {"refresh_token_hashes": {"$each": [token_hash], "$slice": -5}}},
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest):
    user = await database.db.users.find_one({"email": body.email, "is_active": True})
    if not user or not verify_password(body.password, user["password_hash"]):
        logger.warning("Failed login attempt for {}", body.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, user["role"], user.get("leader_id"))
    refresh_token = create_refresh_token(user_id)
    await _store_refresh_token(user["_id"], refresh_token)

    await database.db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )
    logger.info("User logged in: {}", body.email)

    await audit_service.log_event(
        entity_type="auth",
        entity_id=user_id,
        entity_label=body.email,
        action="login",
        user=user,
        changes=[],
        source="auth",
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_serialize_user(user),
    )


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return _serialize_user(current_user)


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = await database.db.users.find_one({"_id": ObjectId(user_id), "is_active": True})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_hash = hash_refresh_token(body.refresh_token)
    stored = user.get("refresh_token_hashes", [])
    if token_hash not in stored:
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    await database.db.users.update_one(
        {"_id": user["_id"]},
        {"$pull": {"refresh_token_hashes": token_hash}},
    )

    access_token = create_access_token(user_id, user["role"], user.get("leader_id"))
    new_refresh = create_refresh_token(user_id)
    await _store_refresh_token(user["_id"], new_refresh)

    return {
        "access_token": access_token,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


@router.post("/logout", status_code=204)
async def logout(current_user: dict = Depends(get_current_user)):
    await database.db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"refresh_token_hashes": []}},
    )
    logger.info("User logged out: {}", current_user.get("email"))
    return None
