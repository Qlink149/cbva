import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { useLeaders } from '@/hooks/useLeaders';
import { useAdminFinancialYears } from '@/hooks/useAdmin';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useToast } from '@/components/ui/use-toast';
import {
  useKraCategories,
  useKraCompetencies,
  useUpdateCompetency,
  useDeleteCompetency,
  useKraKpis,
  useCreateKpi,
  useUpdateKpi,
  useDeleteKpi,
  useKraWeights,
  useUpsertKraWeights,
  useCopyKraLayer,
  useRemoveLeaderKra,
} from '@/hooks/useKra';

function pct(decimal) {
  if (decimal == null || Number.isNaN(Number(decimal))) return '';
  return String(Math.round(Number(decimal) * 1000) / 10);
}

function toDecimal(percentStr) {
  const n = parseFloat(percentStr);
  if (Number.isNaN(n)) return 0;
  return n / 100;
}

function WeightEditor({ layer, fiscalYear, leaderId, categories }) {
  const { toast } = useToast();
  const { data, isLoading } = useKraWeights(layer, fiscalYear, leaderId);
  const upsert = useUpsertKraWeights();
  const [row, setRow] = useState({});

  useEffect(() => {
    const next = {};
    (categories || []).forEach((c) => {
      next[c.id] = pct(data?.weights?.[c.id]);
    });
    setRow(next);
  }, [data, categories]);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const decimals = (categories || []).map((c) => toDecimal(row[c.id]));
  const total = decimals.reduce((a, b) => a + b, 0);
  const off = Math.abs(total - 1) > 0.005;
  const rowLabel = layer === 'all_time' ? 'Default' : layer === 'fy' ? 'FY default' : 'This leader';

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">Category weights</h3>
      <p className="text-sm text-muted-foreground">
        Values are percentages; they should sum to 100%.
      </p>
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b">
              <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Row</th>
              {(categories || []).map((c) => (
                <th key={c.id} className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">{c.name}</th>
              ))}
              <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 px-3 text-sm font-medium whitespace-nowrap">{rowLabel}</td>
              {(categories || []).map((c) => (
                <td key={c.id} className="py-2 px-2">
                  <Input
                    className="h-8 w-20"
                    value={row[c.id] ?? ''}
                    onChange={(e) => setRow((p) => ({ ...p, [c.id]: e.target.value }))}
                  />
                </td>
              ))}
              <td className={`py-2 px-3 text-sm ${off ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                {(total * 100).toFixed(1)}%{off ? ' ≠ 100%' : ''}
              </td>
              <td className="py-2 px-3 text-right whitespace-nowrap">
                <Button
                  size="sm"
                  className="bg-cbva-navy h-8"
                  onClick={async () => {
                    const weights = {};
                    (categories || []).forEach((c) => { weights[c.id] = toDecimal(row[c.id]); });
                    try {
                      await upsert.mutateAsync({
                        layer,
                        fiscal_year: layer === 'all_time' ? null : fiscalYear,
                        leader_id: layer === 'leader' ? leaderId : null,
                        weights,
                      });
                      toast({ title: 'Weights saved' });
                    } catch (err) {
                      toast({ title: 'Save failed', description: err?.response?.data?.detail || err.message, variant: 'destructive' });
                    }
                  }}
                >
                  Save
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiEditor({ layer, fiscalYear, leaderId, categories, categoryWeights }) {
  const { toast } = useToast();
  const { data, isLoading } = useKraKpis(layer, fiscalYear, leaderId);
  const kpis = data?.data ?? [];
  const createKpi = useCreateKpi();
  const updateKpi = useUpdateKpi();
  const deleteKpi = useDeleteKpi();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category_id: '', kpi_name: '', sub_weight: '5', rating_band_text: '',
    target_measurement_text: '', frequency_source: '',
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const layerBody = {
    layer,
    fiscal_year: layer === 'all_time' ? null : fiscalYear,
    leader_id: layer === 'leader' ? leaderId : null,
  };

  const saveEdits = async (kpi, patch) => {
    try {
      await updateKpi.mutateAsync({ id: kpi.id, ...patch });
    } catch (err) {
      toast({ title: 'Update failed', description: err?.response?.data?.detail || err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">KPI definitions</h3>
          {layer === 'all_time' ? (
            <p className="text-sm text-muted-foreground">
              Seeded from the FY26-27 Leader Scorecard sheet as a starting default only. B2 (which sheet is final) is not decided — edit these rows when the client answers.
            </p>
          ) : null}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-cbva-navy"><Plus className="w-4 h-4 mr-1" />Add KPI</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add KPI</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm((p) => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {(categories || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>KPI name</Label><Input value={form.kpi_name} onChange={(e) => setForm((p) => ({ ...p, kpi_name: e.target.value }))} /></div>
              <div><Label>Sub-weight %</Label><Input value={form.sub_weight} onChange={(e) => setForm((p) => ({ ...p, sub_weight: e.target.value }))} /></div>
              <div><Label>Rating bands</Label><Textarea value={form.rating_band_text} onChange={(e) => setForm((p) => ({ ...p, rating_band_text: e.target.value }))} /></div>
              <div><Label>Target measurement</Label><Textarea value={form.target_measurement_text} onChange={(e) => setForm((p) => ({ ...p, target_measurement_text: e.target.value }))} /></div>
              <div><Label>Frequency / source</Label><Input value={form.frequency_source} onChange={(e) => setForm((p) => ({ ...p, frequency_source: e.target.value }))} /></div>
              <Button
                className="w-full bg-cbva-navy"
                onClick={async () => {
                  try {
                    await createKpi.mutateAsync({
                      ...layerBody,
                      category_id: form.category_id,
                      kpi_name: form.kpi_name,
                      sub_weight: toDecimal(form.sub_weight),
                      rating_band_text: form.rating_band_text,
                      target_measurement_text: form.target_measurement_text,
                      frequency_source: form.frequency_source,
                      sort_order: (kpis?.length || 0) + 1,
                    });
                    setOpen(false);
                  } catch (err) {
                    toast({ title: 'Create failed', description: err?.response?.data?.detail || err.message, variant: 'destructive' });
                  }
                }}
              >
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {(categories || []).map((cat) => {
        const rows = (kpis || []).filter((k) => k.category_id === cat.id);
        const subSum = rows.reduce((a, k) => a + (k.sub_weight || 0), 0);
        const catWeight = categoryWeights?.[cat.id] ?? 0;
        const mismatch = catWeight > 0 && Math.abs(subSum - catWeight) > 0.005;
        return (
          <div key={cat.id} className="bg-card rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
              <span className="text-sm font-medium">{cat.name}</span>
              <span className={`text-xs ${mismatch ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                Sub-weights {(subSum * 100).toFixed(1)}% / category {(catWeight * 100).toFixed(1)}%
                {mismatch ? ' — do not match' : ''}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium w-[32%]">KPI</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium w-20">Sub %</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Rating bands</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((kpi) => (
                  <tr key={kpi.id} className="border-b align-top">
                    <td className="py-2 px-3">
                      <Textarea
                        className="min-h-[64px] text-xs"
                        defaultValue={kpi.kpi_name}
                        onBlur={(e) => { if (e.target.value !== kpi.kpi_name) saveEdits(kpi, { kpi_name: e.target.value }); }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        className="h-8 w-16"
                        defaultValue={pct(kpi.sub_weight)}
                        onBlur={(e) => { const next = toDecimal(e.target.value); if (next !== kpi.sub_weight) saveEdits(kpi, { sub_weight: next }); }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Textarea
                        className="min-h-[64px] text-xs"
                        defaultValue={kpi.rating_band_text}
                        onBlur={(e) => { if (e.target.value !== kpi.rating_band_text) saveEdits(kpi, { rating_band_text: e.target.value }); }}
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">{kpi.frequency_source}</p>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => {
                        try { await deleteKpi.mutateAsync(kpi.id); } catch (err) {
                          toast({ title: 'Delete failed', description: err?.response?.data?.detail || err.message, variant: 'destructive' });
                        }
                      }}>Remove</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function CompetencyEditor({ layer, fiscalYear, leaderId }) {
  const { toast } = useToast();
  const { data, isLoading } = useKraCompetencies(layer, fiscalYear, leaderId);
  const competencies = data?.data ?? [];
  const update = useUpdateCompetency();
  const remove = useDeleteCompetency();

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">Leadership competencies</h3>
      <p className="text-sm text-muted-foreground">
        The 4th competency has no client definition yet — do not invent criteria. Paste the official text here when it arrives.
      </p>
      {(competencies || []).map((c) => (
        <div key={c.id} className="bg-card rounded-lg border p-3 space-y-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Name</Label>
              <Input defaultValue={c.name} onBlur={(e) => { if (e.target.value !== c.name) update.mutate({ id: c.id, name: e.target.value }); }} />
            </div>
            <div className="w-24">
              <Label>Weight %</Label>
              <Input defaultValue={pct(c.weight)} onBlur={(e) => { const next = toDecimal(e.target.value); if (next !== c.weight) update.mutate({ id: c.id, weight: next }); }} />
            </div>
            {layer !== 'all_time' ? (
              <Button size="sm" variant="ghost" className="text-red-600 self-end" onClick={async () => {
                try { await remove.mutateAsync(c.id); } catch (err) {
                  toast({ title: 'Delete failed', description: err?.response?.data?.detail || err.message, variant: 'destructive' });
                }
              }}>Remove</Button>
            ) : null}
          </div>
          <div>
            <Label>Meets-expectations criteria</Label>
            <Textarea
              className="min-h-[96px] text-sm"
              defaultValue={c.criteria_text || ''}
              onBlur={(e) => {
                if (e.target.value !== (c.criteria_text || '')) {
                  update.mutate(
                    { id: c.id, criteria_text: e.target.value },
                    {
                      onError: (err) =>
                        toast({ title: 'Save failed', description: err?.response?.data?.detail || err.message, variant: 'destructive' }),
                    },
                  );
                }
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LayerEditors({ layer, fiscalYear, leaderId, categories }) {
  const { data: weightData } = useKraWeights(layer, fiscalYear, leaderId);
  return (
    <div className="space-y-8">
      <WeightEditor layer={layer} fiscalYear={fiscalYear} leaderId={leaderId} categories={categories} />
      <KpiEditor layer={layer} fiscalYear={fiscalYear} leaderId={leaderId} categories={categories} categoryWeights={weightData?.weights} />
      <CompetencyEditor layer={layer} fiscalYear={fiscalYear} leaderId={leaderId} />
    </div>
  );
}

export default function KraConfigTab() {
  const { toast } = useToast();
  const { data: categories = [], isLoading: catLoading } = useKraCategories();
  const { data: financialYears = [], isLoading: fyLoading } = useAdminFinancialYears();
  const { data: leaders = [] } = useLeaders();
  const { activeFY } = useGlobalSelector();
  const [fiscalYear, setFiscalYear] = useState(activeFY || '');
  const [leaderId, setLeaderId] = useState('');
  const fyList = Array.isArray(financialYears) ? financialYears : [];
  const leaderList = Array.isArray(leaders) ? leaders : [];
  const copyLayer = useCopyKraLayer();
  const removeLeader = useRemoveLeaderKra();

  const fyKpis = useKraKpis('fy', fiscalYear);
  const fyWeights = useKraWeights('fy', fiscalYear);
  const fyComps = useKraCompetencies('fy', fiscalYear);
  const leaderKpis = useKraKpis('leader', fiscalYear, leaderId);
  const leaderWeights = useKraWeights('leader', fiscalYear, leaderId);
  const leaderComps = useKraCompetencies('leader', fiscalYear, leaderId);

  const hasFy = !!(fyKpis.data?.exists || fyWeights.data?.exists || fyComps.data?.exists);
  const hasLeader = !!(leaderKpis.data?.exists || leaderWeights.data?.exists || leaderComps.data?.exists);

  useEffect(() => {
    if (!fiscalYear && (activeFY || fyList[0]?.slug)) setFiscalYear(activeFY || fyList[0].slug);
  }, [fiscalYear, activeFY, fyList]);

  if (catLoading || fyLoading) return <Skeleton className="h-64 w-full" />;

  const doCopy = async (target, lid) => {
    try {
      await copyLayer.mutateAsync({ target_layer: target, fiscal_year: fiscalYear, leader_id: lid || null });
      toast({ title: target === 'fy' ? 'FY copy created from all-time default' : 'Leader copy created' });
    } catch (err) {
      toast({ title: 'Copy failed', description: err?.response?.data?.detail || err.message, variant: 'destructive' });
    }
  };

  const fySelect = (
    <div className="w-48">
      <Label className="text-xs">Financial year</Label>
      <Select value={fiscalYear} onValueChange={setFiscalYear}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select FY" /></SelectTrigger>
        <SelectContent>
          {fyList.map((fy) => (
            <SelectItem key={fy.slug || fy.id} value={fy.slug}>{fy.label || getFyLabel(fy.slug) || fy.slug}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Tabs defaultValue="all_time" className="space-y-4">
      <TabsList className="bg-muted/50">
        <TabsTrigger value="all_time">All-time default</TabsTrigger>
        <TabsTrigger value="fy">This FY</TabsTrigger>
        <TabsTrigger value="leader">This leader</TabsTrigger>
      </TabsList>
      <p className="text-xs text-muted-foreground">
        Copies are independent. Editing all-time does not change an FY or leader copy already made.
      </p>

      <TabsContent value="all_time" className="mt-2 space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Seeded KPI list is the <strong>FY26-27 Leader Scorecard</strong> sheet (17 KPIs). That is a starting default only — B2 is still open with the client. Changing sheets later is an edit here, not a code change. Self and ExCo ratings stay separate (B3 also open).
        </div>
        <LayerEditors layer="all_time" categories={categories} />
      </TabsContent>

      <TabsContent value="fy" className="mt-2 space-y-4">
        {fySelect}
        {fiscalYear && !hasFy ? (
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm text-muted-foreground">No FY copy yet. Scorecards for this year use the all-time default until you copy.</p>
            <Button className="bg-cbva-navy" onClick={() => doCopy('fy')} disabled={copyLayer.isPending}>
              Copy all-time default into this FY
            </Button>
          </div>
        ) : fiscalYear ? (
          <LayerEditors layer="fy" fiscalYear={fiscalYear} categories={categories} />
        ) : null}
      </TabsContent>

      <TabsContent value="leader" className="mt-2 space-y-4">
        <div className="flex flex-wrap gap-4">
          {fySelect}
          <div className="w-56">
            <Label className="text-xs">Leader</Label>
            <Select value={leaderId} onValueChange={setLeaderId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select leader" /></SelectTrigger>
              <SelectContent>
                {leaderList.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {leaderId && fiscalYear && !hasLeader ? (
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              No leader copy. This person’s scorecard uses the FY list (or all-time if there is no FY copy).
            </p>
            <Button className="bg-cbva-navy" onClick={() => doCopy('leader', leaderId)} disabled={copyLayer.isPending}>
              Customize this leader
            </Button>
          </div>
        ) : leaderId && fiscalYear ? (
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="text-red-600"
              onClick={async () => {
                try {
                  await removeLeader.mutateAsync({ fiscal_year: fiscalYear, leader_id: leaderId });
                  toast({ title: 'Leader copy removed — they fall back to FY / all-time' });
                } catch (err) {
                  toast({ title: 'Remove failed', description: err?.response?.data?.detail || err.message, variant: 'destructive' });
                }
              }}
            >
              Remove leader copy
            </Button>
            <LayerEditors layer="leader" fiscalYear={fiscalYear} leaderId={leaderId} categories={categories} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a leader to customize or view their copy.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
