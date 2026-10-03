import { useEffect, useMemo, useState, Fragment } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useAuth } from '@/lib/AuthContext';
import { useLeader } from '@/hooks/useLeaders';
import { useKraCategories, useResolvedKra } from '@/hooks/useKra';
import {
  useAppraisalRound,
  useAppraisalRounds,
  useScorecard,
  useSubmitRound,
  useUpsertRoundRatings,
} from '@/hooks/useAppraisals';
import { toast } from 'sonner';

const ROUND_CHIPS = [
  { type: 'self_midyear', label: 'Self mid-year' },
  { type: 'mgmt_midyear', label: 'Management mid-year' },
  { type: 'self_yearend', label: 'Self year-end' },
  { type: 'mgmt_yearend', label: 'Management year-end' },
];

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(2);
}

function canWriteRound(user, round) {
  if (!user || !round || round.state !== 'open') return false;
  if (round.round_type?.startsWith('self_')) {
    return user.role === 'user' && user.leader_id === round.leader_id;
  }
  if (round.round_type?.startsWith('mgmt_')) {
    return user.role === 'management' || user.role === 'admin';
  }
  return false;
}

function stateBadge(state) {
  const cls =
    state === 'submitted'
      ? 'bg-status-green-bg text-status-green'
      : state === 'locked'
        ? 'bg-muted text-muted-foreground'
        : 'bg-blue-50 text-cbva-navy';
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>
      {state || 'open'}
    </span>
  );
}

function RatingForm({ roundId, fiscalYear, leaderId }) {
  const { user } = useAuth();
  const { data: round, isLoading: roundLoading } = useAppraisalRound(roundId);
  const { data: categories = [] } = useKraCategories();
  const { data: resolved, isLoading: resolvedLoading } = useResolvedKra(fiscalYear, leaderId);
  const kpis = resolved?.kpis ?? [];
  const competencies = resolved?.competencies ?? [];
  const upsert = useUpsertRoundRatings();
  const submit = useSubmitRound();
  const [kpiState, setKpiState] = useState({});
  const [compState, setCompState] = useState({});

  useEffect(() => {
    if (!round) return;
    const next = {};
    (round.kpi_ratings || []).forEach((r) => {
      next[r.kpi_definition_id] = { rating: r.rating ?? '', comment: r.comment || '' };
    });
    setKpiState(next);
    const comps = {};
    (round.competency_ratings || []).forEach((r) => {
      comps[r.competency_id] = r.rating ?? '';
    });
    setCompState(comps);
  }, [round]);

  if (roundLoading || resolvedLoading || !round) return <Skeleton className="h-64 w-full" />;

  const writable = canWriteRound(user, round);
  const isMgmtRound = round.round_type?.startsWith('mgmt_');
  if (user?.role === 'user' && isMgmtRound) {
    return (
      <p className="text-sm text-muted-foreground">
        Management rounds are entered by ExCo / admin. You can see those ratings on the Summary tab.
      </p>
    );
  }

  const save = async () => {
    try {
      await upsert.mutateAsync({
        roundId,
        kpi_ratings: (kpis || []).map((k) => ({
          kpi_definition_id: k.id,
          rating: kpiState[k.id]?.rating === '' || kpiState[k.id]?.rating == null
            ? null
            : Number(kpiState[k.id].rating),
          comment: kpiState[k.id]?.comment || '',
        })).filter((r) => r.rating != null || r.comment),
        competency_ratings: (competencies || []).map((c) => ({
          competency_id: c.id,
          rating: compState[c.id] === '' || compState[c.id] == null ? null : Number(compState[c.id]),
        })).filter((r) => r.rating != null),
      });
      toast.success('Ratings saved');
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || 'Could not save ratings');
    }
  };

  const onSubmit = async () => {
    try {
      await save();
      await submit.mutateAsync(roundId);
      toast.success('Round submitted');
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || 'Could not submit');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {stateBadge(round.state)}
        {!writable && round.state === 'open' && (
          <span className="text-xs text-muted-foreground">View only — you cannot rate this round.</span>
        )}
      </div>
      {(categories || []).map((cat) => {
        const rows = (kpis || []).filter((k) => k.category_id === cat.id);
        if (!rows.length) return null;
        return (
          <div key={cat.id} className="bg-card rounded-lg border overflow-hidden">
            <div className="px-4 py-2 bg-muted/30 border-b text-sm font-medium">{cat.name}</div>
            <div className="divide-y">
              {rows.map((kpi) => (
                <div key={kpi.id} className="p-4 space-y-2">
                  <p className="text-sm font-medium leading-snug">{kpi.kpi_name}</p>
                  {kpi.rating_band_text ? (
                    <p className="text-xs text-muted-foreground">{kpi.rating_band_text}</p>
                  ) : null}
                  {kpi.target_measurement_text ? (
                    <p className="text-xs text-muted-foreground">{kpi.target_measurement_text}</p>
                  ) : null}
                  <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Rating (1–5)</p>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        step={0.5}
                        disabled={!writable}
                        value={kpiState[kpi.id]?.rating ?? ''}
                        onChange={(e) =>
                          setKpiState((p) => ({
                            ...p,
                            [kpi.id]: { ...p[kpi.id], rating: e.target.value, comment: p[kpi.id]?.comment || '' },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Comment / feedforward</p>
                      <Textarea
                        className="min-h-[64px]"
                        disabled={!writable}
                        value={kpiState[kpi.id]?.comment ?? ''}
                        onChange={(e) =>
                          setKpiState((p) => ({
                            ...p,
                            [kpi.id]: { ...p[kpi.id], comment: e.target.value, rating: p[kpi.id]?.rating ?? '' },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-2 bg-muted/30 border-b text-sm font-medium">Leadership competencies</div>
        <div className="divide-y">
          {(competencies || []).map((c) => (
            <div key={c.id} className="p-4 space-y-2">
              <p className="text-sm font-medium">{c.name}</p>
              {c.criteria_text ? (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{c.criteria_text}</pre>
              ) : null}
              <div className="w-32">
                <p className="text-[11px] text-muted-foreground mb-1">Rating (1–5)</p>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={0.5}
                  disabled={!writable}
                  value={compState[c.id] ?? ''}
                  onChange={(e) => setCompState((p) => ({ ...p, [c.id]: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {writable ? (
        <div className="flex gap-2">
          <Button className="bg-cbva-navy" onClick={save} disabled={upsert.isPending}>
            {upsert.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          <Button variant="outline" onClick={onSubmit} disabled={submit.isPending}>
            Submit round
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ScorecardSummary({ leaderId, fiscalYear }) {
  const [period, setPeriod] = useState('yearend');
  const { data, isLoading } = useScorecard(leaderId, fiscalYear, period);

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={period === 'yearend' ? 'default' : 'outline'} className={period === 'yearend' ? 'bg-cbva-navy' : ''} onClick={() => setPeriod('yearend')}>
          Year-end
        </Button>
        <Button size="sm" variant={period === 'midyear' ? 'default' : 'outline'} className={period === 'midyear' ? 'bg-cbva-navy' : ''} onClick={() => setPeriod('midyear')}>
          Mid-year
        </Button>
        <div className="ml-auto rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          Combined score: pending spec
          <span className="ml-2 text-muted-foreground">({data.combined_score_status})</span>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-xs min-w-[960px]">
          <thead>
            <tr className="bg-muted/30 border-b">
              {['KPI', 'Self Rating', 'Self Avg', 'Self Wg Avg', 'ExCo Rating', 'ExCo Avg', 'ExCo Wg Avg', 'Feedforward'].map((h) => (
                <th key={h} className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.categories || []).map((cat) => (
              <Fragment key={cat.id}>
                <tr className="bg-muted/20">
                  <td className="py-2 px-2 font-semibold" colSpan={8}>
                    {cat.name} ({Math.round((cat.weight || 0) * 100)}%)
                  </td>
                </tr>
                {(cat.kpis || []).map((kpi) => (
                  <tr key={kpi.id} className="border-b align-top">
                    <td className="py-2 px-2 max-w-sm">{kpi.kpi_name}</td>
                    <td className="py-2 px-2">{fmt(kpi.self_rating)}</td>
                    <td className="py-2 px-2 text-muted-foreground"> </td>
                    <td className="py-2 px-2 text-muted-foreground"> </td>
                    <td className="py-2 px-2">{fmt(kpi.exco_rating)}</td>
                    <td className="py-2 px-2 text-muted-foreground"> </td>
                    <td className="py-2 px-2 text-muted-foreground"> </td>
                    <td className="py-2 px-2 text-muted-foreground max-w-xs">{kpi.feedforward || '—'}</td>
                  </tr>
                ))}
                <tr className="border-b bg-muted/10 font-medium">
                  <td className="py-2 px-2">Category total</td>
                  <td className="py-2 px-2"> </td>
                  <td className="py-2 px-2">{fmt(cat.self_avg)}</td>
                  <td className="py-2 px-2">{fmt(cat.self_wg_avg)}</td>
                  <td className="py-2 px-2"> </td>
                  <td className="py-2 px-2">{fmt(cat.exco_avg)}</td>
                  <td className="py-2 px-2">{fmt(cat.exco_wg_avg)}</td>
                  <td className="py-2 px-2"> </td>
                </tr>
              </Fragment>
            ))}
            <tr className="bg-cbva-navy/5 font-semibold">
              <td className="py-2 px-2">Overall (weighted)</td>
              <td className="py-2 px-2"> </td>
              <td className="py-2 px-2"> </td>
              <td className="py-2 px-2">{fmt(data.overall?.self_wg_avg)}</td>
              <td className="py-2 px-2"> </td>
              <td className="py-2 px-2"> </td>
              <td className="py-2 px-2">{fmt(data.overall?.exco_wg_avg)}</td>
              <td className="py-2 px-2"> </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-2 bg-muted/30 border-b text-sm font-medium">
          Competency ratings (not folded into category totals)
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 text-xs text-muted-foreground">Competency</th>
              <th className="text-left py-2 px-3 text-xs text-muted-foreground">Self</th>
              <th className="text-left py-2 px-3 text-xs text-muted-foreground">ExCo</th>
            </tr>
          </thead>
          <tbody>
            {(data.competencies || []).map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-2 px-3">{c.name}</td>
                <td className="py-2 px-3">{fmt(c.self_rating)}</td>
                <td className="py-2 px-3">{fmt(c.exco_rating)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Scorecard() {
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { data: leader } = useLeader(selectedLeaderId);
  const { data: rounds = [], isLoading } = useAppraisalRounds(selectedLeaderId, activeFY);
  const [roundType, setRoundType] = useState('self_yearend');

  const selectedRound = useMemo(
    () => (rounds || []).find((r) => r.round_type === roundType),
    [rounds, roundType],
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Scorecard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {leader?.name || selectedLeaderId} — Self and ExCo ratings side by side. Combined score is pending spec (B3).
          </p>
        </div>
        <LeaderFYSelector />
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="rate">Rate</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
          {!selectedLeaderId || !activeFY ? (
            <p className="text-sm text-muted-foreground">Select a leader and financial year.</p>
          ) : (
            <ScorecardSummary leaderId={selectedLeaderId} fiscalYear={activeFY} />
          )}
        </TabsContent>
        <TabsContent value="rate" className="mt-4 space-y-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {ROUND_CHIPS.map((chip) => (
                  <Button
                    key={chip.type}
                    size="sm"
                    variant={roundType === chip.type ? 'default' : 'outline'}
                    className={roundType === chip.type ? 'bg-cbva-navy' : ''}
                    onClick={() => setRoundType(chip.type)}
                  >
                    {chip.label}
                  </Button>
                ))}
              </div>
              {selectedRound ? (
                <RatingForm roundId={selectedRound.id} fiscalYear={activeFY} leaderId={selectedLeaderId} />
              ) : (
                <p className="text-sm text-muted-foreground">No round found for this leader / FY.</p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
