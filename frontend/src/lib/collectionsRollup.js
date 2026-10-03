/**
 * Shared roll-up helpers deriving per-client, per-month Planned vs Collected
 * from engagements (monthly_plan) + collection_transactions.
 */

import { FY_MONTHS } from '@/lib/fyMonths';

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

/** Leader-month actuals from GET /api/collections rows (FY2526 import path). */
export function leaderMonthActualsFromCollectionApi(rows = []) {
  const map = {};
  rows.forEach((r) => {
    map[r.month_key] = r.actual ?? r.collected ?? 0;
  });
  return map;
}

/**
 * Month-aligned YoY rows from two GET /api/collections datasets (prior vs current FY).
 * Uses actual ?? collected per month_key; includes YTD summary.
 */
export function buildYoYMonthRows(priorRows = [], currentRows = []) {
  const priorMap = leaderMonthActualsFromCollectionApi(priorRows);
  const currentMap = leaderMonthActualsFromCollectionApi(currentRows);

  const rows = FY_MONTHS.map(({ key, label, full }) => {
    const prior = priorMap[key] ?? 0;
    const current = currentMap[key] ?? 0;
    const delta = current - prior;
    const deltaPct = prior !== 0 ? (delta / prior) * 100 : (current !== 0 ? null : 0);
    return { month_key: key, monthLabel: label, monthFull: full, prior, current, delta, deltaPct };
  });

  const ytd = rows.reduce(
    (acc, r) => ({
      prior: acc.prior + r.prior,
      current: acc.current + r.current,
      delta: acc.delta + r.delta,
    }),
    { prior: 0, current: 0, delta: 0 },
  );
  ytd.deltaPct = ytd.prior !== 0 ? (ytd.delta / ytd.prior) * 100 : (ytd.current !== 0 ? null : 0);

  return { rows, ytd };
}

/** Closed historical FY: Green = Total = Collected (annual), no Amber/Blue, Balance 0. */
export function historicalYearEngagementTotals(ytdCollected) {
  const n = ytdCollected || 0;
  return {
    green: n,
    amber: 0,
    blueSky: 0,
    total: n,
    collected: n,
    balance: 0,
  };
}
