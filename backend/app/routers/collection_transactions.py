from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.collection_transaction import CollectionTransactionCreate, CollectionTransactionResponse
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service
from app.services.fiscal_year import assert_fy_editable

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
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


def _tx_label(tx: dict, engagement_name: str | None = None) -> str:
    if engagement_name:
        return f"{engagement_name} — {tx.get('month', '')}"
    return tx.get("client_name") or str(tx.get("_id", ""))


def _collected_derived(old_collected: int, new_collected: int, old_balance: int, new_balance: int) -> list[dict]:
    derived: list[dict] = []
    if old_collected != new_collected:
        derived.append(
            {
                "field": "collected",
                "label": "Collected",
                "old": old_collected,
                "new": new_collected,
                "derived": True,
            }
        )
    if old_balance != new_balance:
        derived.append(
            {
                "field": "balance",
                "label": "Balance",
                "old": old_balance,
                "new": new_balance,
                "derived": True,
            }
        )
    return derived


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
    await assert_fy_editable(body.fiscal_year, current_user)

    engagement = await database.db.engagements.find_one({"_id": ObjectId(body.engagement_id)})
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    if engagement["leader_id"] != body.leader_id or engagement["fiscal_year"] != body.fiscal_year:
        raise HTTPException(status_code=400, detail="Engagement does not match leader/fiscal year")

    old_collected = engagement.get("collected", 0)
    old_balance = engagement.get("balance", 0)

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

    eng_after = await database.db.engagements.find_one({"_id": ObjectId(body.engagement_id)})
    derived = _collected_derived(
        old_collected,
        eng_after.get("collected", 0) if eng_after else old_collected,
        old_balance,
        eng_after.get("balance", 0) if eng_after else old_balance,
    )
    label = _tx_label(doc, engagement.get("name"))
    await audit_service.log_event(
        entity_type="collection_transaction",
        entity_id=str(doc["_id"]),
        entity_label=label,
        action="created",
        user=current_user,
        changes=derived,
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )

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
    await assert_fy_editable(tx["fiscal_year"], current_user)

    engagement = await database.db.engagements.find_one({"_id": ObjectId(tx["engagement_id"])})
    old_collected = engagement.get("collected", 0) if engagement else 0
    old_balance = engagement.get("balance", 0) if engagement else 0
    eng_name = engagement.get("name") if engagement else None

    engagement_id = tx["engagement_id"]
    await database.db.collection_transactions.delete_one({"_id": ObjectId(transaction_id)})
    await _recompute_engagement_collected(engagement_id)

    eng_after = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    derived = _collected_derived(
        old_collected,
        eng_after.get("collected", 0) if eng_after else 0,
        old_balance,
        eng_after.get("balance", 0) if eng_after else 0,
    )
    label = _tx_label(tx, eng_name)
    await audit_service.log_delete(
        "collection_transaction", tx, current_user,
        label=label,
        changes=derived,
        leader_id=tx["leader_id"],
        fiscal_year=tx["fiscal_year"],
    )
    return None
