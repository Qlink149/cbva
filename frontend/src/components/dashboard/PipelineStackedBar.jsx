import React from 'react';
import { TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { formatINR } from '@/lib/formatCurrency';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  green: '#10B981',
  amber: '#F59E0B',
  blueSky: '#3B82F6',
};

const EMPTY_PLAN = { green: 0, amber: 0, blueSky: 0, total: 0 };

function StatusPill({ color, label, amount }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-[11px] font-semibold text-slate-700 font-tabular">{formatINR(amount)}</span>
    </div>
  );
}

function PlanCard({ label, sublabel, data, badge }) {
  const greenW = data.total > 0 ? (data.green / data.total) * 100 : 0;
  const amberW = data.total > 0 ? (data.amber / data.total) * 100 : 0;
  const blueSkyW = data.total > 0 ? (data.blueSky / data.total) * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-slate-800">{label}</p>
            {badge}
          </div>
          {sublabel && <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>}
        </div>
        <p className="text-[18px] font-bold text-slate-800 font-tabular">{formatINR(data.total)}</p>
      </div>

      <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden mb-3">
        <div className="h-full flex w-full">
          {data.green > 0 && <div className="h-full" style={{ width: `${greenW}%`, background: STATUS_COLORS.green }} />}
          {data.amber > 0 && <div className="h-full" style={{ width: `${amberW}%`, background: STATUS_COLORS.amber }} />}
          {data.blueSky > 0 && <div className="h-full" style={{ width: `${blueSkyW}%`, background: STATUS_COLORS.blueSky }} />}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <StatusPill color={STATUS_COLORS.green} label="Green" amount={data.green} />
        <StatusPill color={STATUS_COLORS.amber} label="Amber" amount={data.amber} />
        <StatusPill color={STATUS_COLORS.blueSky} label="Blue Sky" amount={data.blueSky} />
      </div>
    </div>
  );
}

export default function PipelineStackedBar({
  originalPlan,
  revisedPlan,
  originalLabel = 'Original Board Plan',
  originalSublabel = 'Set at start of FY',
  revisedLabel = 'Latest Pipeline',
  revisedSublabel = 'Current month update',
  dividerLabel,
  priorYearVariance,
}) {
  const navigate = useNavigate();
  const orig = originalPlan ?? EMPTY_PLAN;
  const rev = revisedPlan ?? orig;
  const delta = rev.total - orig.total;
  const pctChange = orig.total > 0 ? ((delta / orig.total) * 100).toFixed(1) : '0.0';
  const hasChange = Math.abs(delta) > 0;

  const DeltaBadge = () => {
    if (!hasChange) return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
        <Minus className="w-2.5 h-2.5" /> No Change
      </span>
    );
    const isUp = delta > 0;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
        {isUp ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
        {isUp ? '+' : ''}{pctChange}% ({formatINR(Math.abs(delta))})
      </span>
    );
  };

  const hasData = orig.total > 0 || rev.total > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cbva-navy to-blue-700 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Pipeline Set by Board</span>
        </div>

        {!hasData ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No pipeline data available.</p>
        ) : (
          <>
            <PlanCard label={originalLabel} sublabel={originalSublabel} data={orig} />

            {dividerLabel && (
              <div className="flex items-center gap-2 my-3 px-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{dividerLabel}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            )}

            <PlanCard
              label={revisedLabel}
              sublabel={revisedSublabel}
              data={rev}
              badge={<DeltaBadge />}
            />

            <div className="mt-4 flex gap-3 border-t border-slate-100 pt-3">
              {['Green', 'Amber', 'Blue Sky'].map(status => (
                <button
                  key={status}
                  onClick={() => navigate(`/my-plan/pipeline?status=${encodeURIComponent(status)}`)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                  View {status} →
                </button>
              ))}
            </div>

            {priorYearVariance && (
              <div style={{ background: '#f9f9f9', margin: '40px -24px -24px -24px', padding: '32px 24px 40px' }}>
                <p className="text-[11px] text-slate-500 mb-3">{priorYearVariance.label || 'Variance from prior FY'}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${priorYearVariance.pct >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.abs(priorYearVariance.pct), 100)}%` }}
                    />
                  </div>
                  <span className={`text-[12px] font-bold font-tabular whitespace-nowrap ${priorYearVariance.pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {priorYearVariance.pct >= 0 ? '+' : ''}{formatINR(priorYearVariance.amount)} ({priorYearVariance.pct >= 0 ? '+' : ''}{priorYearVariance.pct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
