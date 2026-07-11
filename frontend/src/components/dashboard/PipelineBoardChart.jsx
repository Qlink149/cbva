import React from 'react';
import { formatINRFull } from '@/lib/formatCurrency';
import { hardcodedBoardPlan } from '@/lib/consolidatedSummary';

function fmt(val) {
  return formatINRFull(val);
}

export default function PipelineBoardChart({
  pipelineData = [],
  fyLabel = '',
  fySlug = '',
  leaderId = '',
  baseline = null,
  prevFyBlueSky = null,
  prevFyTotal = null,
  prevFyLabel = '',
}) {
  const boardOverride = hardcodedBoardPlan(fySlug, leaderId);
  const boardFromPipeline = pipelineData.find(r => r.label?.toLowerCase().includes('board')) ||
    pipelineData.find(r => r.amber != null || r.blueSky != null) ||
    pipelineData[0];
  const board = boardOverride
    ? {
        ...boardFromPipeline,
        label: boardOverride.label,
        green: boardOverride.green,
        amber: boardOverride.amber,
        blueSky: boardOverride.blueSky,
        total: boardOverride.total,
      }
    : boardFromPipeline;
  const latest = pipelineData[pipelineData.length - 1];

  const boardTotal = board ? (board.total || ((board.green || 0) + (board.amber || 0) + (board.blueSky || 0))) : null;
  const latestTotal = latest ? (latest.total || ((latest.green || 0) + (latest.amber || 0) + (latest.blueSky || 0))) : null;
  const prevTotal = prevFyTotal || null;

  const variancePrevYear = prevTotal && latestTotal ? (((latestTotal - prevTotal) / prevTotal) * 100).toFixed(1) : null;
  const varianceBoard = boardTotal && latestTotal && board !== latest
    ? (((latestTotal - boardTotal) / boardTotal) * 100).toFixed(1)
    : null;

  const hasBaseline = baseline && baseline.baseline_total > 0;

  const rows = [
    { label: 'Green', board: board?.green, current: latest?.green, target: hasBaseline ? baseline.baseline_green : undefined, bg: '#00FF00', color: '#000000' },
    { label: 'Amber', board: board?.amber, current: latest?.amber, target: hasBaseline ? baseline.baseline_amber : undefined, bg: '#FF8800', color: '#000000' },
    { label: 'Blue Sky', board: board?.blueSky, current: latest?.blueSky, target: hasBaseline ? baseline.baseline_blue_sky : undefined, bg: '#00CCFF', color: '#000000' },
    { label: 'Total', board: boardTotal, current: latestTotal, target: hasBaseline ? baseline.baseline_total : undefined, bg: '#D9D9D9', color: '#000000', bold: true },
  ];

  const boardLabel = board?.label || 'Board Plan';
  const latestLabel = latest?.label || 'Latest';
  const prevYearLabel = prevFyLabel || 'Previous Year';

  // Split long board labels so "(March 2026)" wraps to its own line
  const boardLabelMatch = String(boardLabel).match(/^(.*?)(\s*\([^)]+\))\s*$/);
  const boardLabelMain = boardLabelMatch ? boardLabelMatch[1].trim() : boardLabel;
  const boardLabelSub = boardLabelMatch ? boardLabelMatch[2].trim() : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)]">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Pipeline · {fyLabel}
          </p>
        </div>

        <div className="rounded-lg border border-[#BFBFBF] overflow-hidden">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead>
              <tr style={{ background: '#808080' }}>
                <th className="text-left px-2 py-2 font-bold text-white border border-[#BFBFBF]" style={{ fontSize: 11, width: '22%' }}>Particular</th>
                <th className="text-right px-2 py-2 font-bold text-white border border-[#BFBFBF] col-num leading-tight" style={{ fontSize: 11 }}>
                  <span className="block">{boardLabelMain}</span>
                  {boardLabelSub && (
                    <span className="block font-semibold opacity-90 mt-0.5" style={{ fontSize: 10 }}>{boardLabelSub}</span>
                  )}
                </th>
                {hasBaseline && (
                  <th className="text-right px-2 py-2 font-bold text-white border border-[#BFBFBF] col-num" style={{ fontSize: 11 }}>Target</th>
                )}
                <th className="text-right px-2 py-2 font-bold text-white border border-[#BFBFBF] col-num" style={{ fontSize: 11 }}>{latestLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} style={{ background: row.bg }}>
                  <td className="px-2 py-2 border border-[#BFBFBF]" style={{ color: row.color, fontWeight: row.bold ? 700 : 500, fontSize: 11 }}>{row.label}</td>
                  <td className="px-2 py-2 text-right font-tabular border border-[#BFBFBF] col-num whitespace-nowrap" style={{ color: row.color, fontWeight: row.bold ? 700 : 400, fontSize: 11 }}>{fmt(row.board)}</td>
                  {hasBaseline && (
                    <td className="px-2 py-2 text-right font-tabular border border-[#BFBFBF] col-num whitespace-nowrap" style={{ color: row.color, fontWeight: row.bold ? 700 : 400, fontSize: 11 }}>{fmt(row.target)}</td>
                  )}
                  <td className="px-2 py-2 text-right font-tabular border border-[#BFBFBF] col-num whitespace-nowrap" style={{ color: row.color, fontWeight: row.bold ? 700 : 400, fontSize: 11 }}>{fmt(row.current)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 space-y-1">
          {prevFyBlueSky != null && (
            <p className="text-[12px] text-slate-500">
              Blue Sky · {prevFyLabel || 'Last FY'} actual:{' '}
              <span className="font-bold text-slate-700 font-tabular">{fmt(prevFyBlueSky)}</span>
              {latest?.blueSky != null && prevFyBlueSky > 0 && (
                <span className={`ml-1 font-semibold ${latest.blueSky - prevFyBlueSky >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ({latest.blueSky - prevFyBlueSky >= 0 ? '+' : ''}{(((latest.blueSky - prevFyBlueSky) / prevFyBlueSky) * 100).toFixed(1)}% YoY)
                </span>
              )}
            </p>
          )}
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