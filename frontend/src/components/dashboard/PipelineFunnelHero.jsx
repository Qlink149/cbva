import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '@/lib/formatCurrency';
import { ChevronRight, Sparkles, TrendingUp, AlertCircle, PlusCircle, ArrowUpDown } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const FY_MONTHS = [
  { key: '04', label: 'Apr' }, { key: '05', label: 'May' },
  { key: '06', label: 'Jun' }, { key: '07', label: 'Jul' },
  { key: '08', label: 'Aug' }, { key: '09', label: 'Sep' },
  { key: '10', label: 'Oct' }, { key: '11', label: 'Nov' },
  { key: '12', label: 'Dec' }, { key: '01', label: 'Jan' },
  { key: '02', label: 'Feb' }, { key: '03', label: 'Mar' },
];

const PIE_GRADIENTS = [
  { id: 'gGreen', from: '#059669', to: '#34D399', status: 'green' },
  { id: 'gAmber', from: '#D97706', to: '#FCD34D', status: 'amber' },
  { id: 'gBlue',  from: '#2563EB', to: '#93C5FD', status: 'blueSky' },
];

const STATUS_LABELS = { green: 'Green', amber: 'Amber', blueSky: 'Blue Sky' };
const STATUS_COLORS = { green: '#10B981', amber: '#F59E0B', blueSky: '#3B82F6' };
const STATUS_PILL = {
  green:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border border-amber-200',
  blueSky: 'bg-blue-50 text-blue-700 border border-blue-200',
};

const BAR_COLORS = {
  green:   { grad: 'barGreen',   from: '#059669', to: '#34D399' },
  amber:   { grad: 'barAmber',   from: '#D97706', to: '#FCD34D' },
  blueSky: { grad: 'barBlueSky', from: '#2563EB', to: '#93C5FD' },
};

function computeMonthStats(engagements, monthlyLines, monthKey) {
  const monthLines = monthlyLines.filter(l => {
    if (!l.month) return false;
    return String(new Date(l.month).getMonth() + 1).padStart(2, '0') === monthKey;
  });
  const engMap = {};
  engagements.forEach(e => { engMap[e.id] = { status: e.status, client: e.client_name || 'Unknown' }; });
  let green = 0, amber = 0, blueSky = 0;
  const clients = {};
  monthLines.forEach(l => {
    const billing = l.actual_billing || 0;
    if (!billing) return;
    const eng = l.engagement_id ? engMap[l.engagement_id] : null;
    const status = eng?.status || null;
    const clientName = eng?.client || l.client_name || 'Unknown';
    if (!clients[clientName]) clients[clientName] = { green: 0, amber: 0, blueSky: 0, total: 0 };
    if (status === 'Green')         { green += billing; clients[clientName].green += billing; }
    else if (status === 'Amber')    { amber += billing; clients[clientName].amber += billing; }
    else if (status === 'Blue Sky') { blueSky += billing; clients[clientName].blueSky += billing; }
    else                            { green += billing; clients[clientName].green += billing; }
    clients[clientName].total += billing;
  });
  return { green, amber, blueSky, total: green + amber + blueSky, clients };
}

function deriveTimeline(engagements, monthlyLines) {
  const months = FY_MONTHS.map(m => ({
    key: m.key, label: m.label,
    stats: computeMonthStats(engagements, monthlyLines, m.key),
  })).filter(m => m.stats.total > 0);

  const events = [];
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1];
    const curr = months[i];
    const changes = [];
    ['green', 'amber', 'blueSky'].forEach(s => {
      const delta = curr.stats[s] - prev.stats[s];
      if (Math.abs(delta) > 0) {
        const allClients = new Set([...Object.keys(prev.stats.clients), ...Object.keys(curr.stats.clients)]);
        const clientDeltas = [];
        allClients.forEach(cn => {
          const d = (curr.stats.clients[cn]?.[s] || 0) - (prev.stats.clients[cn]?.[s] || 0);
          if (Math.abs(d) > 0) clientDeltas.push({ client: cn, delta: d });
        });
        clientDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        changes.push({ status: s, delta, clientDeltas });
      }
    });
    if (changes.length) events.push({ month: curr.label, prevMonth: prev.label, changes });
  }
  return events.reverse();
}

// Derive pipeline-level alerts — only events that increase or decrease total pipeline amount
function derivePipelineAlerts(engagements) {
  const alerts = [];
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  // New engagements added (increases total pipeline)
  const newEngagements = engagements.filter(e =>
    e.created_date && new Date(e.created_date) >= cutoff
  );

  if (newEngagements.length > 0) {
    const totalAdded = newEngagements.reduce((s, e) => s + (e.amount || 0), 0);
    if (totalAdded > 0) {
      alerts.push({
        icon: 'plus',
        color: 'green',
        title: `${newEngagements.length} new engagement${newEngagements.length > 1 ? 's' : ''} added`,
        detail: `+${formatINR(totalAdded)} to total pipeline`,
        clients: newEngagements
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .map(e => ({ name: e.client_name || 'Unknown', amount: e.amount || 0, status: e.status })),
      });
    }
  }

  // Archived/removed engagements (decreases total pipeline) — amount > 0 and is_archived = true recently
  const recentlyArchived = engagements.filter(e =>
    e.is_archived === true &&
    e.updated_date && new Date(e.updated_date) >= cutoff
  );

  if (recentlyArchived.length > 0) {
    const totalRemoved = recentlyArchived.reduce((s, e) => s + (e.amount || 0), 0);
    if (totalRemoved > 0) {
      alerts.push({
        icon: 'alert',
        color: 'red',
        title: `${recentlyArchived.length} engagement${recentlyArchived.length > 1 ? 's' : ''} removed`,
        detail: `-${formatINR(totalRemoved)} from total pipeline`,
        clients: recentlyArchived
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .map(e => ({ name: e.client_name || 'Unknown', amount: e.amount || 0, status: e.status })),
      });
    }
  }

  return alerts;
}

const ALERT_STYLES = {
  blue:  { dot: '#3B82F6' },
  green: { dot: '#10B981' },
  amber: { dot: '#F59E0B' },
  red:   { dot: '#EF4444' },
};

function AlertIcon({ type }) {
  if (type === 'plus') return <PlusCircle className="w-3.5 h-3.5" />;
  if (type === 'alert') return <AlertCircle className="w-3.5 h-3.5" />;
  return <ArrowUpDown className="w-3.5 h-3.5" />;
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800">{STATUS_LABELS[d.key] || d.key}</p>
      <p className="text-slate-500 font-tabular">{formatINR(d.value)}</p>
    </div>
  );
}

function CustomBarTooltip({ active, payload, label, monthlyLines, engagements }) {
  if (!active || !payload?.length) return null;
  const monthKey = FY_MONTHS.find(m => m.label === label)?.key;
  const stats = monthKey ? computeMonthStats(engagements, monthlyLines, monthKey) : null;
  const topClients = stats
    ? Object.entries(stats.clients).sort((a, b) => b[1].total - a[1].total).slice(0, 4)
    : [];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-3 text-xs min-w-[180px]">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      <div className="space-y-0.5 mb-2.5">
        {payload.filter(p => p.value > 0).map(p => (
          <p key={p.dataKey} className="font-tabular flex justify-between gap-3" style={{ color: STATUS_COLORS[p.dataKey] }}>
            <span>{STATUS_LABELS[p.dataKey]}</span>
            <span className="font-semibold">{formatINR(p.value)}</span>
          </p>
        ))}
      </div>
      {topClients.length > 0 && (
        <div className="border-t border-slate-100 pt-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Top Clients</p>
          {topClients.map(([name, s]) => (
            <p key={name} className="flex justify-between gap-3 text-slate-600 font-tabular">
              <span className="truncate max-w-[110px]">{name}</span>
              <span className="font-medium">{formatINR(s.total)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PipelineFunnelHero({ data }) {
  const navigate = useNavigate();
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);

  const { unidentified_bs = 0, identified_bs = 0, amber = 0, green = 0 } = data || {};
  const engagements = data?._engagements || [];
  const monthlyLines = data?._monthlyLines || [];

  const total = green + amber + identified_bs + unidentified_bs;
  const blueSky = identified_bs + unidentified_bs;

  const pieData = [
    { key: 'green',   value: green,   label: 'Green' },
    { key: 'amber',   value: amber,   label: 'Amber' },
    { key: 'blueSky', value: blueSky, label: 'Blue Sky' },
  ].filter(d => d.value > 0);

  const barData = useMemo(() =>
    FY_MONTHS.map(m => {
      const s = computeMonthStats(engagements, monthlyLines, m.key);
      return { month: m.label, green: s.green, amber: s.amber, blueSky: s.blueSky, total: s.total };
    }),
    [engagements, monthlyLines]
  );

  const hasBarData = barData.some(d => d.total > 0);
  const timeline = useMemo(() => deriveTimeline(engagements, monthlyLines), [engagements, monthlyLines]);
  const pipelineAlerts = useMemo(() => derivePipelineAlerts(engagements), [engagements]);

  const handlePieClick = (entry) => {
    const statusMap = { green: 'Green', amber: 'Amber', blueSky: 'Blue Sky' };
    const status = statusMap[entry?.key];
    if (status) navigate(`/my-plan/pipeline?status=${encodeURIComponent(status)}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* LEFT — Pipeline Set by Board */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden relative flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/80 via-transparent to-blue-50/30 pointer-events-none" />
        <div className="relative flex-1 flex flex-col p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cbva-navy to-blue-700 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Pipeline Set by Board</span>
          </div>

          {/* Pie + Legend */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <defs>
                    {PIE_GRADIENTS.map(g => (
                      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={g.from} />
                        <stop offset="100%" stopColor={g.to} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={pieData} cx={75} cy={75}
                    innerRadius={46} outerRadius={72}
                    dataKey="value" paddingAngle={3} strokeWidth={0}
                    onClick={(_, idx) => handlePieClick(pieData[idx])}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((entry, i) => {
                      const gId = PIE_GRADIENTS.find(g => g.status === entry.key)?.id || PIE_GRADIENTS[i % 3].id;
                      return <Cell key={i} fill={`url(#${gId})`} />;
                    })}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">Total</p>
                <p className="text-[15px] font-bold font-tabular text-foreground leading-tight mt-0.5">{formatINR(total)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 flex-1">
              {pieData.map(d => (
                <button
                  key={d.key}
                  onClick={() => handlePieClick(d)}
                  className="flex items-center justify-between group hover:opacity-80 transition-opacity text-left w-full"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[d.key] }} />
                    <span className="text-xs font-medium text-foreground">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-tabular font-semibold text-foreground">{formatINR(d.value)}</span>
                    <span className="text-[10px] text-muted-foreground font-tabular">
                      {total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : ''}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline Alerts */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Recent Pipeline Changes
            </p>

            {pipelineAlerts.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground italic">No new pipeline changes in last 30 days.</div>
            ) : (
              <div className="space-y-2">
                {pipelineAlerts.map((alert, i) => {
                  const style = ALERT_STYLES[alert.color] || ALERT_STYLES.blue;
                  const isOpen = expandedAlert === i;
                  return (
                    <motion.div key={i} layout className="rounded-xl border border-border/60 bg-background overflow-hidden">
                      <button
                        onClick={() => setExpandedAlert(isOpen ? null : i)}
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span style={{ color: style.dot }}><AlertIcon type={alert.icon} /></span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-foreground leading-tight">{alert.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{alert.detail}</p>
                          </div>
                        </div>
                        <ChevronRight className={`w-3 h-3 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {isOpen && alert.clients?.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.16 }}
                          >
                            <div className="px-3.5 pb-3 border-t border-border/40">
                              <div className="mt-2 space-y-0.5">
                                {alert.clients.slice(0, 5).map((c, ci) => (
                                  <div key={ci} className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded-lg hover:bg-muted/30">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[c.status === 'Green' ? 'green' : c.status === 'Amber' ? 'amber' : 'blueSky'] }} />
                                      <span className="text-foreground truncate max-w-[150px]">{c.name}</span>
                                    </div>
                                    <span className="font-tabular font-semibold text-foreground">{formatINR(c.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — Monthly Movement (bar chart + timeline) */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden relative flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 via-transparent to-slate-50/20 pointer-events-none" />
        <div className="relative flex-1 flex flex-col p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Monthly Movement</span>
          </div>

          <div className="flex items-center gap-4 mb-3">
            {Object.entries(BAR_COLORS).map(([key, cfg]) => (
              <span key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.from }} />
                {STATUS_LABELS[key]}
              </span>
            ))}
          </div>

          {!hasBarData ? (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">No billing data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={14} barGap={2} barCategoryGap="28%">
                <defs>
                  {Object.entries(BAR_COLORS).map(([key, cfg]) => (
                    <linearGradient key={key} id={cfg.grad} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={cfg.from} />
                      <stop offset="100%" stopColor={cfg.to} stopOpacity={0.65} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatINR(v)} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip
                  content={<CustomBarTooltip monthlyLines={monthlyLines} engagements={engagements} />}
                  cursor={{ fill: 'rgba(148,163,184,0.06)', radius: 4 }}
                />
                <Bar dataKey="green"   fill={`url(#${BAR_COLORS.green.grad})`}   radius={[3, 3, 0, 0]} />
                <Bar dataKey="amber"   fill={`url(#${BAR_COLORS.amber.grad})`}   radius={[3, 3, 0, 0]} />
                <Bar dataKey="blueSky" fill={`url(#${BAR_COLORS.blueSky.grad})`} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Monthly Changes Timeline below chart */}
          {timeline.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Month-on-Month Changes
              </p>
              <div className="space-y-2">
                {timeline.slice(0, 4).map((event, i) => {
                  const isOpen = expandedEvent === i;
                  const netDelta = event.changes.reduce((s, c) => s + c.delta, 0);
                  // one-line summary
                  const summary = event.changes.map(c => {
                    const top = c.clientDeltas[0];
                    return `${STATUS_LABELS[c.status]} ${c.delta > 0 ? '↑' : '↓'} ${formatINR(Math.abs(c.delta))}${top ? ` (${top.client})` : ''}`;
                  }).join(' · ');

                  return (
                    <motion.div key={i} layout className="rounded-xl border border-border/60 bg-background overflow-hidden">
                      <button
                        onClick={() => setExpandedEvent(isOpen ? null : i)}
                        className="w-full flex items-start justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-cbva-navy">{event.prevMonth} → {event.month}</span>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{summary}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          <span className={`text-[10px] font-bold font-tabular ${netDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {netDelta >= 0 ? '+' : ''}{formatINR(netDelta)}
                          </span>
                          <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </div>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                          >
                            <div className="px-3.5 pb-3.5 border-t border-border/40">
                              <div className="mt-2.5 space-y-2.5">
                                {event.changes.map((c, ci) => (
                                  <div key={ci}>
                                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-1 ${STATUS_PILL[c.status]}`}>
                                      {STATUS_LABELS[c.status]} {c.delta > 0 ? '▲' : '▼'} {formatINR(Math.abs(c.delta))}
                                    </span>
                                    {c.clientDeltas.slice(0, 4).map((cd, cdi) => (
                                      <div key={cdi} className="flex items-center justify-between text-[11px] px-2 py-0.5 rounded-lg hover:bg-muted/30">
                                        <span className="text-foreground truncate max-w-[160px]">{cd.client}</span>
                                        <span className={`font-tabular font-semibold ${cd.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                          {cd.delta > 0 ? '+' : ''}{formatINR(cd.delta)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}