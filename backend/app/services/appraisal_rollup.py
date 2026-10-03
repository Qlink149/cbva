"""Live scorecard rollups. Combined score is a stub until B3 is decided."""

from __future__ import annotations


def compute_combined_score(self_wg_avg: float | None, exco_wg_avg: float | None) -> None:
    """B3 slot — no formula yet. Do not average at write or display time."""
    return None


def _mean(values: list[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    if not present:
        return None
    return sum(present) / len(present)


def category_avg(ratings: list[float | None]) -> float | None:
    return _mean(ratings)


def category_weighted_avg(items: list[tuple[float, float | None]]) -> float | None:
    """items: (sub_weight, rating). Unrated rows are excluded."""
    rated = [(w, r) for w, r in items if r is not None]
    weight_sum = sum(w for w, _ in rated)
    if weight_sum <= 0:
        return None
    return sum(r * w for w, r in rated) / weight_sum


def kpi_contribution(
    rating: float | None,
    sub_weight: float,
    category_sub_weight_sum: float,
    category_weight: float,
) -> float | None:
    if rating is None or category_sub_weight_sum <= 0:
        return None
    return rating * (sub_weight / category_sub_weight_sum) * category_weight


def overall_weighted_avg(
    kpis: list[dict],
    ratings_by_kpi_id: dict[str, float | None],
    category_weights: dict[str, float],
) -> float | None:
    """Sum of per-KPI contributions. Partial scorecards are not renormalised."""
    by_cat: dict[str, list[dict]] = {}
    for kpi in kpis:
        by_cat.setdefault(kpi["category_id"], []).append(kpi)

    total = 0.0
    any_rated = False
    for category_id, cat_kpis in by_cat.items():
        cat_weight = category_weights.get(category_id, 0.0)
        rated = [
            k
            for k in cat_kpis
            if ratings_by_kpi_id.get(str(k.get("id") or k.get("_id"))) is not None
        ]
        sub_sum = sum(k["sub_weight"] for k in rated)
        if sub_sum <= 0:
            continue
        for kpi in rated:
            kid = str(kpi.get("id") or kpi.get("_id"))
            contrib = kpi_contribution(
                ratings_by_kpi_id[kid],
                kpi["sub_weight"],
                sub_sum,
                cat_weight,
            )
            if contrib is not None:
                total += contrib
                any_rated = True
    return total if any_rated else None
