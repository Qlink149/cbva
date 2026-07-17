import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Settings, Users, Building2, Briefcase, Calendar, Target } from 'lucide-react';
import { formatINR } from '@/lib/formatCurrency';
import { useBaselines } from '@/hooks/useBaselines';
import {
  useAdminUsers, useCreateUser, useUpdateUser, useDeactivateUser,
  useAppSettings, useUpdateAppSettings,
  useAdminClients, useCreateAdminClient,
  useAdminEngagementTypes, useCreateEngagementType,
  useAdminFinancialYears, useCreateFinancialYear, useUpdateFinancialYear,
  useAdminPlans, useUpsertAdminPlans,
} from '@/hooks/useAdmin';
import { useLeaders } from '@/hooks/useLeaders';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useToast } from '@/components/ui/use-toast';
function UsersTab() {
  const { data: users = [], isLoading } = useAdminUsers();
  const { data: leaders = [] } = useLeaders();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'user', designation: '', leader_id: '' });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Users ({users.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-cbva-navy hover:bg-cbva-navy/90"><Plus className="w-4 h-4 mr-1" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-4">
              <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['admin', 'management', 'user'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Leader</Label>
                <Select value={form.leader_id || 'none'} onValueChange={v => setForm(p => ({ ...p, leader_id: v === 'none' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(Array.isArray(leaders) ? leaders : []).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { createUser.mutate({ ...form, leader_id: form.leader_id || null }); setOpen(false); }} className="w-full bg-cbva-navy">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30 border-b">
            <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Name</th>
            <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Email</th>
            <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Role</th>
            <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Leader</th>
            <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Active</th>
            <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="py-2 px-3 font-medium">{u.full_name}</td>
                <td className="py-2 px-3 text-muted-foreground">{u.email}</td>
                <td className="py-2 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{u.role}</span></td>
                <td className="py-2 px-3 text-muted-foreground">{u.leader_id || '—'}</td>
                <td className="py-2 px-3">
                  <Switch checked={u.is_active} onCheckedChange={v => updateUser.mutate({ id: u.id, is_active: v })} />
                </td>
                <td className="py-2 px-3 text-right">
                  {u.is_active && <Button variant="ghost" size="sm" onClick={() => deactivateUser.mutate(u.id)}>Deactivate</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSettings = useUpdateAppSettings();
  const [form, setForm] = useState(null);

  React.useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (isLoading || !form) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4 max-w-lg">
      <h3 className="text-lg font-medium">App Settings</h3>
      <div><Label>App Name</Label><Input value={form.app_name || ''} onChange={e => setForm(p => ({ ...p, app_name: e.target.value }))} /></div>
      <div><Label>Active Fiscal Years (comma-separated)</Label>
        <Input value={(form.active_fiscal_years || []).join(', ')} onChange={e => setForm(p => ({ ...p, active_fiscal_years: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={form.maintenance_mode || false} onCheckedChange={v => setForm(p => ({ ...p, maintenance_mode: v }))} />
        <Label>Maintenance Mode</Label>
      </div>
      <Button onClick={() => updateSettings.mutate(form)} className="bg-cbva-navy">Save Settings</Button>
    </div>
  );
}

function ClientsTab() {
  const { data: clients = [], isLoading } = useAdminClients();
  const create = useCreateAdminClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Corporate', status: 'Active' });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Clients Master ({clients.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-cbva-navy hover:bg-cbva-navy/90"><Plus className="w-4 h-4 mr-1" />Add Client</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Corporate', 'Promoter/HNI', 'Family Office', 'NRI', 'Foreign Co', 'SME', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { create.mutate(form); setOpen(false); setForm({ name: '', type: 'Corporate', status: 'Active' }); }} className="w-full bg-cbva-navy">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30 border-b"><th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Name</th><th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Type</th><th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Status</th></tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="py-2 px-3 font-medium">{c.name}</td>
                <td className="py-2 px-3 text-muted-foreground">{c.type}</td>
                <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'Active' ? 'bg-status-green-bg text-status-green' : 'bg-muted text-muted-foreground'}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EngagementTypesTab() {
  const { data: types = [], isLoading } = useAdminEngagementTypes();
  const create = useCreateEngagementType();
  const [name, setName] = useState('');

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Engagement Types ({types.length})</h3>
      <div className="flex gap-2">
        <Input placeholder="New type name..." value={name} onChange={e => setName(e.target.value)} className="max-w-sm" />
        <Button onClick={() => name && create.mutate({ name, is_active: true })} size="sm" className="bg-cbva-navy"><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {types.map(t => (
          <div key={t.id} className="bg-card rounded-lg border px-3 py-2 text-sm flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-status-green' : 'bg-muted-foreground'}`} />
            {t.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function BaselineTab() {
  const { data: baselines = [], isLoading } = useBaselines();
  const { data: leaders = [] } = useLeaders();
  const leaderList = Array.isArray(leaders) ? leaders : [];
  const leaderMap = Object.fromEntries(leaderList.map(l => [l.id, l.name]));

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Baseline Plans</h3>
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30 border-b">
            <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Leader</th>
            <th className="text-right py-2 text-xs text-muted-foreground font-medium col-num">Green</th>
            <th className="text-right py-2 text-xs text-muted-foreground font-medium col-num">Amber</th>
            <th className="text-right py-2 text-xs text-muted-foreground font-medium col-num">Blue Sky</th>
            <th className="text-right py-2 text-xs text-muted-foreground font-medium col-num">Total</th>
            <th className="text-center py-2 text-xs text-muted-foreground font-medium col-num">Locked</th>
          </tr></thead>
          <tbody>
            {baselines.map(b => (
              <tr key={b.id} className="border-b border-border/50">
                <td className="py-2 px-3 font-medium">{leaderMap[b.leader_id] || b.leader_id}</td>
                <td className="py-2 text-right font-tabular col-num">{formatINR(b.baseline_green)}</td>
                <td className="py-2 text-right font-tabular col-num">{formatINR(b.baseline_amber)}</td>
                <td className="py-2 text-right font-tabular col-num">{formatINR(b.baseline_blue_sky)}</td>
                <td className="py-2 text-right font-tabular font-medium col-num">{formatINR(b.baseline_total)}</td>
                <td className="py-2 text-center col-num">{b.is_locked ? '🔒' : '🔓'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FYTab() {
  const { data: fys = [], isLoading } = useAdminFinancialYears();
  const create = useCreateFinancialYear();
  const update = useUpdateFinancialYear();
  const [form, setForm] = useState({ slug: '', label: '', is_current: false });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Financial Years</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-cbva-navy"><Plus className="w-4 h-4 mr-1" />Add FY</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Financial Year</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-4">
              <div><Label>Slug (e.g. 2728)</Label><Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} /></div>
              <div><Label>Label</Label><Input placeholder="FY 27-28" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} /></div>
              <Button onClick={() => { create.mutate({ ...form, is_active: true, sort_order: fys.length + 1 }); setOpen(false); }} className="w-full bg-cbva-navy">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {fys.map(fy => (
          <div key={fy.id || fy.slug} className={`bg-card rounded-lg border px-4 py-3 flex items-center justify-between gap-4 flex-wrap ${fy.is_current ? 'ring-2 ring-cbva-navy/20' : ''}`}>
            <div>
              <span className="font-medium">{fy.label}</span>
              {fy.is_current && <span className="ml-2 text-xs bg-cbva-navy text-white px-2 py-0.5 rounded-full">Current</span>}
              {!fy.is_active && <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inactive</span>}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{fy.slug}</span>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Active</Label>
                <Switch
                  checked={fy.is_active !== false}
                  onCheckedChange={v => update.mutate({ id: fy.id, is_active: v })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Current</Label>
                <Switch
                  checked={!!fy.is_current}
                  onCheckedChange={v => v && update.mutate({ id: fy.id, is_current: true })}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(fy)}>Edit</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Financial Year</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 mt-4">
              <div><Label>Label</Label><Input value={editing.label} onChange={e => setEditing(p => ({ ...p, label: e.target.value }))} /></div>
              <div><Label>Sort Order</Label><Input type="number" value={editing.sort_order ?? 0} onChange={e => setEditing(p => ({ ...p, sort_order: parseInt(e.target.value, 10) || 0 }))} /></div>
              <Button
                onClick={() => {
                  update.mutate({ id: editing.id, label: editing.label, sort_order: editing.sort_order });
                  setEditing(null);
                }}
                className="w-full bg-cbva-navy"
              >
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseAmount(val) {
  if (val === '' || val == null) return 0;
  const n = Number(String(val).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function PlanAmountFields({ title, form, setForm, source }) {
  const total = parseAmount(form.green) + parseAmount(form.amber) + parseAmount(form.blue_sky);
  return (
    <div className="bg-card rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {source && (
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {source === 'manual' ? 'Manual' : source}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Green (₹)</Label>
          <Input
            type="number"
            min={0}
            value={form.green}
            onChange={(e) => setForm((p) => ({ ...p, green: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">Amber (₹)</Label>
          <Input
            type="number"
            min={0}
            value={form.amber}
            onChange={(e) => setForm((p) => ({ ...p, amber: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">Blue Sky (₹)</Label>
          <Input
            type="number"
            min={0}
            value={form.blue_sky}
            onChange={(e) => setForm((p) => ({ ...p, blue_sky: e.target.value }))}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Total: <span className="font-tabular font-medium text-foreground">{formatINR(total)}</span>
      </p>
    </div>
  );
}

function PlansTab() {
  const { toast } = useToast();
  const { data: leaders = [], isLoading: leadersLoading } = useLeaders();
  const { data: financialYears = [], isLoading: fyLoading } = useAdminFinancialYears();
  const { activeFY } = useGlobalSelector();
  const [leaderId, setLeaderId] = useState('');
  const [fiscalYear, setFiscalYear] = useState(activeFY || '');
  const [initialForm, setInitialForm] = useState({ green: '', amber: '', blue_sky: '' });
  const [boardForm, setBoardForm] = useState({ green: '', amber: '', blue_sky: '' });

  const leaderList = Array.isArray(leaders) ? leaders : [];
  const fyList = Array.isArray(financialYears) ? financialYears : [];

  const { data: plans, isLoading: plansLoading, isFetching } = useAdminPlans(leaderId, fiscalYear);
  const upsertPlans = useUpsertAdminPlans();

  useEffect(() => {
    if (!leaderId && leaderList.length) setLeaderId(leaderList[0].id);
  }, [leaderId, leaderList]);

  useEffect(() => {
    if (!fiscalYear && (activeFY || fyList[0]?.slug)) {
      setFiscalYear(activeFY || fyList[0].slug);
    }
  }, [fiscalYear, activeFY, fyList]);

  useEffect(() => {
    if (!plans) return;
    setInitialForm({
      green: plans.initial?.green ?? '',
      amber: plans.initial?.amber ?? '',
      blue_sky: plans.initial?.blue_sky ?? '',
    });
    setBoardForm({
      green: plans.board?.green ?? '',
      amber: plans.board?.amber ?? '',
      blue_sky: plans.board?.blue_sky ?? '',
    });
  }, [plans]);

  const handleSave = async () => {
    if (!leaderId || !fiscalYear) return;
    try {
      await upsertPlans.mutateAsync({
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        initial: {
          green: parseAmount(initialForm.green),
          amber: parseAmount(initialForm.amber),
          blue_sky: parseAmount(initialForm.blue_sky),
        },
        board: {
          green: parseAmount(boardForm.green),
          amber: parseAmount(boardForm.amber),
          blue_sky: parseAmount(boardForm.blue_sky),
        },
      });
      toast({ title: 'Plans saved', description: 'Initial and Board plans updated.' });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err?.response?.data?.detail || err.message || 'Could not save plans',
        variant: 'destructive',
      });
    }
  };

  if (leadersLoading || fyLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Initial & Board Plans</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Set governance targets per leader and financial year. Manual entries are not overwritten by imports.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <div>
          <Label>Leader</Label>
          <Select value={leaderId} onValueChange={setLeaderId}>
            <SelectTrigger><SelectValue placeholder="Select leader" /></SelectTrigger>
            <SelectContent>
              {leaderList.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Financial Year</Label>
          <Select value={fiscalYear} onValueChange={setFiscalYear}>
            <SelectTrigger><SelectValue placeholder="Select FY" /></SelectTrigger>
            <SelectContent>
              {fyList.map((fy) => (
                <SelectItem key={fy.slug || fy.id} value={fy.slug}>
                  {fy.label || getFyLabel(fy.slug) || fy.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!leaderId || !fiscalYear ? (
        <p className="text-sm text-muted-foreground">Select a leader and financial year to edit plans.</p>
      ) : plansLoading || isFetching ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-4 max-w-3xl">
          <PlanAmountFields
            title="Initial Plan"
            form={initialForm}
            setForm={setInitialForm}
            source={plans?.initial?.source}
          />
          <PlanAmountFields
            title="Board Plan"
            form={boardForm}
            setForm={setBoardForm}
            source={plans?.board?.source}
          />
          <Button
            className="bg-cbva-navy hover:bg-cbva-navy/90"
            onClick={handleSave}
            disabled={upsertPlans.isPending}
          >
            {upsertPlans.isPending ? 'Saving…' : 'Save Plans'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminSettings() {
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-4xl font-light text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage users, master data and system configuration</p>
      </div>
      <Tabs defaultValue="users">
        <TabsList className="bg-muted/50 flex-wrap h-auto">
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-3.5 h-3.5" />Users</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5"><Target className="w-3.5 h-3.5" />Plans</TabsTrigger>
          <TabsTrigger value="fy" className="gap-1.5"><Calendar className="w-3.5 h-3.5" />Financial Years</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="plans" className="mt-4"><PlansTab /></TabsContent>
        <TabsContent value="fy" className="mt-4"><FYTab /></TabsContent>
      </Tabs>
    </div>
  );
}
