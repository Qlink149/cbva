import re

MONTH_KEY_ALIASES = {
    "04": ["April", "Apr"],
    "05": ["May"],
    "06": ["June", "Jun"],
    "07": ["July", "Jul"],
    "08": ["August", "Aug"],
    "09": ["September", "Sep", "Sept"],
    "10": ["October", "Oct"],
    "11": ["November", "Nov"],
    "12": ["December", "Dec"],
    "01": ["January", "Jan"],
    "02": ["February", "Feb"],
    "03": ["March", "Mar"],
}


def month_aliases(month_key: str) -> list[str]:
    return MONTH_KEY_ALIASES.get(month_key, [])


def month_field_regex(month_key: str) -> str | None:
    aliases = month_aliases(month_key)
    if not aliases:
        return None
    parts = "|".join(re.escape(alias) for alias in aliases)
    return rf"(?:^|/|\s)(?:{parts})(?:\s|$|/|\d)"


def month_label_regex(month_key: str) -> str | None:
    aliases = month_aliases(month_key)
    if not aliases:
        return None
    parts = "|".join(re.escape(alias) for alias in aliases)
    return rf"\b(?:{parts})\b"


def pick_pipeline_snapshot(snapshots: list[dict], month_key: str) -> dict | None:
    label_pattern = month_label_regex(month_key)
    if not label_pattern:
        return None

    monthly = [
        snap for snap in snapshots
        if snap.get("snapshot_type") == "monthly"
        and re.search(label_pattern, snap.get("label") or "", re.I)
    ]
    if not monthly:
        return None

    def score(snap: dict) -> tuple[int, int]:
        label = snap.get("label") or ""
        explicit = 1 if re.match(r"^[A-Za-z]+\s+\d{4}", label.strip()) else 0
        return (explicit, snap.get("sort_order") or 0)

    return max(monthly, key=score)
