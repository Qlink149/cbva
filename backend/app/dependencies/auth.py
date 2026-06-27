from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from bson import ObjectId
from app.core.security import decode_token
from app.core import database

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id: str = payload["sub"]
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await database.db.users.find_one({"_id": ObjectId(user_id), "is_active": True})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_roles(*roles: str):
    """Dependency factory — enforces RBAC."""
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return _check


def enforce_leader_scope(current_user: dict, leader_id: str) -> None:
    """Raise 403 if a 'user' role tries to access another leader's data."""
    if current_user["role"] == "user" and current_user.get("leader_id") != leader_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access to this leader's data is not allowed")


def enforce_leader_write_scope(current_user: dict, leader_id: str) -> None:
    """Raise 403 if user/management tries to write another leader's data. Admin is exempt."""
    if current_user["role"] == "admin":
        return
    if current_user["role"] == "management" and current_user.get("leader_id") != leader_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Management cannot modify other leaders' data",
        )
    enforce_leader_scope(current_user, leader_id)
