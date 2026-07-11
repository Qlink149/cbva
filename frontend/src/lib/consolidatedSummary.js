/** Helpers for consolidated summary export and display. */

export const TONE_STYLES = {
  green: { bg: '#00FF00', color: '#000000', dot: 'bg-emerald-500' },
  amber: { bg: '#FF8800', color: '#000000', dot: 'bg-amber-500' },
  bluesky: { bg: '#00CCFF', color: '#000000', dot: 'bg-sky-500' },
};

/**
 * Frontend-only dashboard overrides for Varun · FY 26-27.
 * Board plan, prior-year totals, and blue-sky ledger — other leaders unaffected.
 */
export const HARDCODED_VARUN_2627 = {
  fy2425Total: 82695305,
  fy2526Total: 126385146,
  boardPlan: {
    label: 'Board Plan FY 26-27 (March 2026)',
    green: 68700000,
    amber: 41150000,
    blueSky: 53150000,
    total: 163000000,
  },
  blueSky: {
    rows: [
      { monthKey: '04', month: 'April 2026', opening: 52400000, additional: null, converted: -1900000, closing: 54300000, remarks: '' },
      { monthKey: '05', month: 'May 2026', opening: 54300000, additional: null, converted: 8410000, closing: 45883750, remarks: '' },
      { monthKey: '06', month: 'June 2026', opening: 45883750, additional: null, converted: -2400000, closing: 48283750, remarks: '' },
      { monthKey: '07', month: 'July 2026', opening: 48283750, additional: null, converted: null, closing: null, remarks: '' },
    ],
    totals: {
      opening: 52400000,
      additional: null,
      converted: 4110000,
      closing: 48283750,
    },
  },
  collections: {
    '04': { planned: 5190250, actual: 4007824, month: 'April 2026' },
    '05': { planned: 16531250, actual: 13019506, month: 'May 2026' },
    '06': { planned: 13484500, actual: 7887504, month: 'June 2026' },
  },
};

export function isVarunHardcode(fySlug, leaderId) {
  return fySlug === '2627' && leaderId === 'varun';
}

export function hardcodedBoardPlan(fySlug, leaderId) {
  if (!isVarunHardcode(fySlug, leaderId)) return null;
  return HARDCODED_VARUN_2627.boardPlan;
}

/** Hardcoded blue-sky rows for Varun only, truncated through the current month. */
export function hardcodedBlueSky(fySlug, leaderId, asOf = new Date()) {
  if (!isVarunHardcode(fySlug, leaderId)) return null;
  const pack = HARDCODED_VARUN_2627.blueSky;

  const curMonth = asOf.getMonth() + 1; // 1-12
  const curKey = String(curMonth).padStart(2, '0');
  const order = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];
  const curIdx = order.indexOf(curKey);

  const rows = pack.rows.filter((r) => {
    const idx = order.indexOf(r.monthKey);
    if (idx < 0 || curIdx < 0) return true;
    return idx <= curIdx;
  });

  const additionalVals = rows.map((r) => r.additional).filter((v) => v != null);
  const convertedVals = rows.map((r) => r.converted).filter((v) => v != null);
  const additional = additionalVals.length ? additionalVals.reduce((s, v) => s + v, 0) : null;
  const converted = convertedVals.length ? convertedVals.reduce((s, v) => s + v, 0) : null;
  const lastWithClosing = [...rows].reverse().find((r) => r.closing != null);

  return {
    rows,
    totals: {
      opening: rows[0]?.opening ?? pack.totals.opening,
      additional,
      converted,
      closing: lastWithClosing?.closing ?? pack.totals.closing,
    },
  };
}

/**
 * Apply Varun collection hardcodes (Apr–Jun planned/actual) onto API rows.
 * Other months keep API values. Returns { rows, totalCollected } or null.
 */
export function hardcodedCollections(fySlug, leaderId, apiRows = []) {
  if (!isVarunHardcode(fySlug, leaderId)) return null;
  const overrides = HARDCODED_VARUN_2627.collections;
  const byKey = Object.fromEntries((apiRows || []).map((r) => [r.month_key, { ...r }]));

  Object.entries(overrides).forEach(([mk, vals], i) => {
    const existing = byKey[mk];
    const planned = vals.planned;
    const actual = vals.actual;
    byKey[mk] = {
      ...(existing || {}),
      month_key: mk,
      month_label: vals.month || existing?.month_label || mk,
      sort_order: existing?.sort_order ?? i + 1,
      planned,
      actual,
      collected: actual,
      variance: actual - planned,
      remarks: existing?.remarks ?? '',
      entry_id: existing?.entry_id ?? null,
      transactions: existing?.transactions ?? [],
    };
  });

  const order = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];
  const rows = order
    .filter((mk) => byKey[mk])
    .map((mk, i) => ({ ...byKey[mk], sort_order: i + 1 }));

  const totalCollected = rows.reduce((s, r) => s + (r.actual ?? r.collected ?? 0), 0);
  return { rows, totalCollected };
}

/** Resolve consolidated column code for a leader id. */
export function leaderCodeFromColumns(columns = [], leaderId) {
  if (!leaderId) return null;
  const hit = columns.find((c) => c.leader_id === leaderId);
  return hit?.code ?? null;
}

function leaderCellAmount(row, code) {
  if (!row || !code) return null;
  const val = row?.values?.[code];
  if (val == null || val === '' || Number.isNaN(Number(val))) return null;
  return Number(val);
}

/**
 * Prior-year YTD rows for Monthly Plan Evolution.
 * Varun · 2627 uses hardcoded FY 24-25 / FY 25-26 totals; other leaders use consolidated.
 * Green / Amber / Blue Sky stay empty (—); Total carries the amount.
 */
export function priorYearActualRowsForLeader(rows = [], columns = [], leaderId, fySlug = '') {
  const code = leaderCodeFromColumns(columns, leaderId);
  const byKey = Object.fromEntries(
    (rows || []).filter((r) => r.kind === 'data' && r.row_key).map((r) => [r.row_key, r])
  );

  const useVarunHardcode = isVarunHardcode(fySlug, leaderId);

  const specs = [
    {
      label: 'FY 24-25',
      amount: useVarunHardcode
        ? HARDCODED_VARUN_2627.fy2425Total
        : leaderCellAmount(byKey.hist_fy2425_actual, code),
    },
    {
      label: 'FY 25-26',
      amount: useVarunHardcode
        ? HARDCODED_VARUN_2627.fy2526Total
        : (
          leaderCellAmount(byKey.fy2526_board_actual_collections_fy_25_26, code)
          ?? leaderCellAmount(byKey.hist_fy2526_actual, code)
        ),
    },
  ];

  return specs.map((spec) => ({
    key: `actual-${spec.label}`,
    label: spec.label,
    green: null,
    amber: null,
    blueSky: null,
    total: spec.amount,
    isActualYtd: true,
  }));
}

export function buildCsv(rows, columns) {
  const esc = (s) => {
    const str = String(s ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = ['Particulars', ...columns.map((c) => c.code), 'Total'];
  const lines = [header.map(esc).join(',')];

  for (const r of rows) {
    if (r.kind === 'section' || r.kind === 'subheader') {
      lines.push([esc(r.label), ...columns.map(() => ''), ''].join(','));
      continue;
    }
    const cells = columns.map((c) => {
      const v = r.values?.[c.code];
      return v == null ? '' : v;
    });
    lines.push([esc(r.label), ...cells, r.total == null ? '' : r.total].join(','));
  }
  return lines.join('\n');
}

export function matrixToDisplayRows(rows) {
  return rows.map((row) => {
    if (row.kind !== 'data') return row;
    const cells = row.values ? Object.values(row.values) : [];
    return { ...row, cells: null };
  });
}
