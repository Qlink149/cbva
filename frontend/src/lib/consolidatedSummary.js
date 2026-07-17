/** Helpers for consolidated summary export and display. */

export const TONE_STYLES = {
  green: { bg: '#00FF00', color: '#000000', dot: 'bg-emerald-500' },
  amber: { bg: '#FF8800', color: '#000000', dot: 'bg-amber-500' },
  bluesky: { bg: '#00CCFF', color: '#000000', dot: 'bg-sky-500' },
};

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
 * Prior-year YTD rows for Monthly Plan Evolution, from the consolidated matrix.
 * Green / Amber / Blue Sky stay empty (—); Total carries the amount.
 */
export function priorYearActualRowsForLeader(rows = [], columns = [], leaderId, fySlug = '') {
  const code = leaderCodeFromColumns(columns, leaderId);
  const byKey = Object.fromEntries(
    (rows || []).filter((r) => r.kind === 'data' && r.row_key).map((r) => [r.row_key, r])
  );

  const specs = [
    {
      label: 'FY 24-25',
      amount: leaderCellAmount(byKey.hist_fy2425_actual, code),
    },
    {
      label: 'FY 25-26',
      amount:
        leaderCellAmount(byKey.fy2526_board_actual_collections_fy_25_26, code)
        ?? leaderCellAmount(byKey.hist_fy2526_actual, code),
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
