/**
 * Shared roll-up helpers deriving per-client, per-month Planned vs Collected
 * from engagements (monthly_plan) + collection_transactions.
 */

/** Group transactions into map[engagementId][monthKey] = sum(amount_collected). */
export function groupTxByEngagementMonth(transactions = []) {
  const map = {};
  transactions.forEach((tx) => {
    const eid = tx.engagement_id;
    const mk = tx.month;
    if (!eid || !mk) return;
    if (!map[eid]) map[eid] = {};
    map[eid][mk] = (map[eid][mk] || 0) + (tx.amount_collected || 0);
  });
  return map;
}

/** Planned amount for an engagement in a given FY month. */
export function plannedForMonth(engagement, monthKey) {
  return engagement?.monthlyPlan?.[monthKey] ?? 0;
}

/** Collected amount for an engagement in a given FY month (from grouped tx map). */
export function collectedForMonth(txMap, engagementId, monthKey) {
  return txMap?.[engagementId]?.[monthKey] ?? 0;
}

/**
 * Build per-client rows for the selected months plus column totals.
 * Returns { rows, totals } where each row has:
 *   { id, name, months: { [monthKey]: { planned, collected, variance } } }
 * and totals mirrors the same per-month shape.
 */
export function buildClientMonthRows(engagements = [], txMap = {}, months = []) {
  const totals = {};
  months.forEach((mk) => { totals[mk] = { planned: 0, collected: 0, variance: 0 }; });

  const rows = engagements.map((eng) => {
    const monthsData = {};
    months.forEach((mk) => {
      const planned = plannedForMonth(eng, mk);
      const collected = collectedForMonth(txMap, eng.id, mk);
      const variance = collected - planned;
      monthsData[mk] = { planned, collected, variance };
      totals[mk].planned += planned;
      totals[mk].collected += collected;
      totals[mk].variance += variance;
    });
    return { id: eng.id, name: eng.name, num: eng.num, months: monthsData };
  });

  return { rows, totals };
}
