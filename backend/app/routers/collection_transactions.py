from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.collection_transaction import CollectionTransactionCreate, CollectionTransactionResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "engagement_id": doc["engagement_id"],
        "month": doc["month"],
        "client_name": doc["client_name"],
        "amount_billed": doc.get("amount_billed", 0),
        "amount_collected": doc["amount_collected"],
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


async def _recompute_engagement_collected(engagement_id: str) -> None:
    """Recompute engagement.collected as the sum of all its collection transactions."""
    agg = await database.db.collection_transactions.aggregate([
        {"$match": {"engagement_id": engagement_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_collected"}}},
    ]).to_list(1)
    total = agg[0]["total"] if agg else 0

    eng = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    if eng:
        balance = (eng.get("total") or 0) - total
        await database.db.engagements.update_one(
            {"_id": ObjectId(engagement_id)},
            {"$set": {"collected": total, "balance": balance, "updated_at": datetime.now(timezone.utc)}},
        )


@router.get("/", response_model=dict)
async def list_collection_transactions(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    month: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    query: dict = {"leader_id": leader_id, "fiscal_year": fiscal_year}
    if month:
        query["month"] = month
    cursor = database.db.collection_transactions.find(query).sort("created_at", 1)
    docs = await cursor.to_list(length=500)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=CollectionTransactionResponse, status_code=201)
async def create_collection_transaction(
    body: CollectionTransactionCreate,
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_write_scope(current_user, body.leader_id)

    engagement = await database.db.engagements.find_one({"_id": ObjectId(body.engagement_id)})
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    if engagement["leader_id"] != body.leader_id or engagement["fiscal_year"] != body.fiscal_year:
        raise HTTPException(status_code=400, detail="Engagement does not match leader/fiscal year")

    now = datetime.now(timezone.utc)
    doc = {
        "leader_id": body.leader_id,
        "fiscal_year": body.fiscal_year,
        "engagement_id": body.engagement_id,
        "month": body.month,
        "client_name": body.client_name,
        "amount_billed": body.amount_billed,
        "amount_collected": body.amount_collected,
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.collection_transactions.insert_one(doc)
    doc["_id"] = result.inserted_id

    await _recompute_engagement_collected(body.engagement_id)

    return _serialize(doc)


@router.delete("/{transaction_id}", status_code=204)
async def delete_collection_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user),
):
    tx = await database.db.collection_transactions.find_one({"_id": ObjectId(transaction_id)})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    enforce_leader_write_scope(current_user, tx["leader_id"])

    engagement_id = tx["engagement_id"]
    await database.db.collection_transactions.delete_one({"_id": ObjectId(transaction_id)})
    await _recompute_engagement_collected(engagement_id)
    return None
