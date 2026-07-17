from fastapi import APIRouter, HTTPException, Depends
from app.schemas.leader import LeaderCreate, LeaderUpdate, LeaderResponse
from app.core import database
from app.dependencies.auth import get_current_user, require_roles
from app.services import audit_service

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "name": doc["name"],
        "practice": doc.get("practice", ""),
        "email": doc.get("email", ""),
        "is_active": doc.get("is_active", True),
    }


@router.get("/", response_model=list[LeaderResponse])
async def list_leaders(current_user: dict = Depends(require_roles("admin", "management"))):
    docs = await database.db.leaders.find({"is_active": True}).to_list(length=50)
    return [_serialize(d) for d in docs]


@router.get("/{leader_id}", response_model=LeaderResponse)
async def get_leader(leader_id: str, current_user: dict = Depends(get_current_user)):
    doc = await database.db.leaders.find_one({"_id": leader_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Leader not found")
    return _serialize(doc)


@router.post("/", response_model=LeaderResponse, status_code=201)
async def create_leader(body: LeaderCreate, current_user: dict = Depends(require_roles("admin"))):
    existing = await database.db.leaders.find_one({"_id": body.id})
    if existing:
        raise HTTPException(status_code=409, detail="Leader ID already exists")
    doc = {"_id": body.id, "name": body.name, "practice": body.practice, "email": body.email, "is_active": True}
    await database.db.leaders.insert_one(doc)
    await audit_service.log_create(
        "leader", doc, current_user,
        label=body.name,
    )
    return _serialize(doc)


@router.put("/{leader_id}", response_model=LeaderResponse)
async def update_leader(leader_id: str, body: LeaderUpdate, current_user: dict = Depends(require_roles("admin"))):
    existing = await database.db.leaders.find_one({"_id": leader_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Leader not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = await database.db.leaders.find_one_and_update(
        {"_id": leader_id}, {"$set": updates}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Leader not found")
    await audit_service.log_update(
        "leader", existing, updates, current_user,
        label=existing["name"],
    )
    return _serialize(result)
