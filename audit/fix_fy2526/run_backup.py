"""Backup engagements, collection_entries, consolidated_summaries, financial_years."""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db_util import get_db, load_env

COLLECTIONS = ["engagements", "collection_entries", "consolidated_summaries", "financial_years"]
ROOT = Path(__file__).resolve().parent.parent / "backups"


def _ts_dir() -> Path:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return ROOT / f"fy2526_fix_{ts}"


async def _json_export(out_dir: Path) -> None:
    from bson.json_util import dumps, default

    client, db = get_db()
    try:
        for name in COLLECTIONS:
            docs = []
            async for doc in db[name].find({}):
                docs.append(doc)
            path = out_dir / f"{name}.json"
            path.write_text(dumps(docs, default=default, indent=2), encoding="utf-8")
            print(f"  exported {len(docs)} docs -> {path.name}")
    finally:
        client.close()


def main() -> None:
    load_env()
    out_dir = _ts_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    db_name = __import__("os").environ["DATABASE_NAME"].strip()
    uri = __import__("os").environ["MONGODB_URL"]

    print(f"Backup dir: {out_dir}")
    coll_args = " ".join(f"--collection={c}" for c in COLLECTIONS)
    cmd = f'mongodump --uri="{uri}" --db={db_name} {coll_args} --out="{out_dir / "mongodump"}"'
    try:
        subprocess.run(cmd, shell=True, check=True)
        print("mongodump OK")
        (out_dir / "BACKUP_METHOD.txt").write_text("mongodump\n", encoding="utf-8")
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        print(f"mongodump unavailable ({exc}); falling back to JSON export")
        asyncio.run(_json_export(out_dir))
        (out_dir / "BACKUP_METHOD.txt").write_text("json_export\n", encoding="utf-8")

    meta = {"timestamp": datetime.now(timezone.utc).isoformat(), "database": db_name, "collections": COLLECTIONS}
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Done: {out_dir}")


if __name__ == "__main__":
    main()
