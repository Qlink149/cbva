import React from 'react';
import { formatINRFull } from '@/lib/formatCurrency';

function fmt(val) {
  return formatINRFull(val);
}

export default function PipelineBoardChart({ pipelineData = [], fyLabel = '' }) {
  const board = pipelineData.find(r => r.label?.toLowerCase().includes('board')) ||
    pipelineData.find(r => r.amber != null || r.blueSky != null) ||
    pipelineData[0];
  const latest = pipelineData[pipelineData.length - 1];
  const prevYearRow = pipelineData.find(r => {
    const label = r.label || '';
    return label.includes('24-25') || label.includes('25-26') || label.includes('25–26');
  });

  const boardTotal = board ? (board.total || ((board.green || 0) + (board.amber || 0) + (board.blueSky || 0))) : null;
  const latestTotal = latest ? (latest.total || ((latest.green || 0) + (latest.amber || 0) + (latest.blueSky || 0))) : null;
  const prevTotal = prevYearRow?.total || null;

  const variancePrevYear = prevTotal && latestTotal ? (((latestTotal - prevTotal) / prevTotal) * 100).toFixed(1) : null;
  const varianceBoard = boardTotal && latestTotal && board !== latest
    ? (((latestTotal - boardTotal) / boardTotal) * 100).toFixed(1)
    : null;

  const rows = [
    { label: 'Green', board: board?.green, current: latest?.green, bg: '#00FF00', color: '#000000' },
    { label: 'Amber', board: board?.amber, current: latest?.amber, bg: '#FF8800', color: '#000000' },
    { label: 'Blue Sky', board: board?.blueSky, current: latest?.blueSky, bg: '#00CCFF', color: '#000000' },
    { label: 'Total', board: boardTotal, current: latestTotal, bg: '#D9D9D9', color: '#000000', bold: true },
  ];

  const boardLabel = board?.label || 'Board Plan';
  const latestLabel = latest?.label || 'Latest';
  const prevYearLabel = prevYearRow?.label || 'Previous Year';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Pipeline · {fyLabel}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#BFBFBF]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: '#808080' }}>
                <th className="text-left px-2 py-2 font-bold text-white border border-[#BFBFBF]" style={{ fontSize: 11 }}>Particular</th>
                <th className="text-right px-2 py-2 font-bold text-white border border-[#BFBFBF]" style={{ fontSize: 11 }}>{boardLabel}</th>
                <th className="text-right px-2 py-2 font-bold text-white border border-[#BFBFBF]" style={{ fontSize: 11 }}>{latestLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} style={{ background: row.bg }}>
                  <td className="px-2 py-2 border border-[#BFBFBF]" style={{ color: row.color, fontWeight: row.bold ? 700 : 500, fontSize: 11 }}>{row.label}</td>
                  <td className="px-2 py-2 text-right font-tabular border border-[#BFBFBF]" style={{ color: row.color, fontWeight: row.bold ? 700 : 400, fontSize: 11 }}>{fmt(row.board)}</td>
                  <td className="px-2 py-2 text-right font-tabular border border-[#BFBFBF]" style={{ color: row.color, fontWeight: row.bold ? 700 : 400, fontSize: 11 }}>{fmt(row.current)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 space-y-1">
          {variancePrevYear !== null && (
            <p className="text-[12px] text-slate-500">
              Variance from {prevYearLabel}:{' '}
              <span className={`font-bold ${parseFloat(variancePrevYear) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {parseFloat(variancePrevYear) >= 0 ? '+' : ''}{variancePrevYear}%
              </span>
            </p>
          )}
          {varianceBoard !== null && (
            <p className="text-[12px] text-slate-500">
              Variance from Board Plan:{' '}
              <span className={`font-bold ${parseFloat(varianceBoard) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {parseFloat(varianceBoard) >= 0 ? '+' : ''}{varianceBoard}%
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}