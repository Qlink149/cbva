"""Flatten phase2/phase3 JSON mismatches to CSV."""
from __future__ import annotations

import csv
import json
from pathlib import Path

AUDIT = Path(__file__).resolve().parent
FIELDS = [
    "id",
    "area",
    "leader",
    "period",
    "sheet",
    "db",
    "api_ui",
    "diff",
    "classification",
    "root_cause",
    "location",
    "proposed_fix",
]


def main() -> None:
    rows = []
    for name in ("phase2_results.json", "phase3_results.json"):
        data = json.loads((AUDIT / name).read_text(encoding="utf-8"))
        rows.extend(data.get("mismatches") or [])
    out = AUDIT / "mismatches.csv"
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) for k in FIELDS})
    print(f"Wrote {out} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
