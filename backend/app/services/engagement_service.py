def compute_totals(green: int, amber: int, blue_sky: int, collected: int) -> dict:
    total = green + amber + blue_sky
    balance = total - collected
    return {"total": total, "balance": balance}
