import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useCreateEngagement } from '@/hooks/useEngagements';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useTeam } from '@/hooks/useTeam';
import { useFirmwideTeam } from '@/hooks/useFirmwide';
import { useLeaders } from '@/hooks/useLeaders';
import PersonSelect from '@/components/clients/PersonSelect';
import PersonMultiSelect from '@/components/clients/PersonMultiSelect';
import { mergePersonOptions } from '@/lib/personNames';
import { isFyEditable } from '@/lib/fiscalYear';
import { useAuth } from '@/lib/AuthContext';

const L = 100000;

const DEFAULT_FORM = {
  name: '',
  manager: '',
  relPartner: '',
  clientScope: 'Domestic',
  elStatus: 'NA',
  green: '',
  amber: '',
  blueSky: '',
  collected: '',
  mayCol: '',
  juneCol: '',
  julyCol: '',
  remarks: '',
};

export default function AddEngagementModal({ onClose, nextNum, partnerOptions = [], showScopeField = false }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const canEdit = isFyEditable(activeFY, fiscalYears, user?.role);
  const { teamMembers } = useTeam(selectedLeaderId, activeFY);
  const { data: firmwideTeam = [] } = useFirmwideTeam(activeFY);
  const { data: leaders = [] } = useLeaders();
  const createMutation = useCreateEngagement();

  const firmwideNames = useMemo(
    () => mergePersonOptions(firmwideTeam.map((m) => m.full_name)),
    [firmwideTeam],
  );

  const managerOptions = useMemo(
    () => mergePersonOptions(
      teamMembers.map((m) => m.full_name),
      firmwideNames,
      leaders.map((l) => l.name),
    ),
    [teamMembers, firmwideNames, leaders],
  );

  const relPartnerOptions = useMemo(
    () => mergePersonOptions(
      partnerOptions,
      leaders.map((l) => l.name),
      firmwideNames,
    ),
    [partnerOptions, leaders, firmwideNames],
  );

  function set(field, val) {
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      const g = parseFloat(updated.green) || 0;
      const a = parseFloat(updated.amber) || 0;
      const b = parseFloat(updated.blueSky) || 0;
      const autoTotal = g + a + b;
      const c = parseFloat(updated.collected) || 0;
      return {
        ...updated,
        ...((['green', 'amber', 'blueSky'].includes(field)) && {
          _autoTotal: autoTotal,
        }),
        balance: ['green', 'amber', 'blueSky', 'collected'].includes(field)
          ? String(Math.max(0, autoTotal - c))
          : updated.balance,
      };
    });
  }

  function handleSave() {
    if (!canEdit) {
      setError('This fiscal year is locked for editing.');
      return;
    }
    if (!form.name.trim()) {
      setError('Client Name is required.');
      return;
    }
    const toVal = v => v === '' ? 0 : Math.round((parseFloat(v) || 0) * L);
    createMutation.mutate({
      leader_id: selectedLeaderId,
      fiscal_year: activeFY,
      num: nextNum,
      name: form.name.trim(),
      manager: form.manager.trim(),
      relPartner: form.relPartner.trim() || '',
      clientScope: showScopeField ? form.clientScope : undefined,
      elStatus: form.elStatus,
      green: toVal(form.green),
      amber: toVal(form.amber),
      blueSky: toVal(form.blueSky),
      collected: toVal(form.collected),
      mayCol: toVal(form.mayCol) || null,
      juneCol: toVal(form.juneCol) || null,
      julyCol: toVal(form.julyCol) || null,
      remarks: form.remarks.trim(),
    }, {
      onSuccess: () => onClose(),
      onError: (err) => setError(err?.response?.data?.detail || 'Failed to save. Please try again.'),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Add Engagement</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <Field label="Client Name *">
            <input
              className="input-base"
              value={form.name}
              onChange={e => { set('name', e.target.value); setError(''); }}
              placeholder="e.g. Tata Consultancy Services"
            />
          </Field>

          <Field label="Manager">
            <PersonSelect
              value={form.manager}
              onChange={(val) => set('manager', val)}
              options={managerOptions}
              placeholder="Select manager"
            />
          </Field>

          <Field label="Rel. Partner">
            <PersonMultiSelect
              value={form.relPartner}
              onChange={(val) => set('relPartner', val)}
              options={relPartnerOptions}
              placeholder="Select relationship partners"
            />
          </Field>

          {showScopeField && (
            <Field label="Scope">
              <select className="input-base" value={form.clientScope} onChange={e => set('clientScope', e.target.value)}>
                <option value="Domestic">Domestic</option>
                <option value="International">International</option>
              </select>
            </Field>
          )}

          <Field label="EL Status">
            <select className="input-base" value={form.elStatus} onChange={e => set('elStatus', e.target.value)}>
              <option value="Signed">Signed</option>
              <option value="Not Signed">Not Signed</option>
              <option value="Waived">Waived</option>
              <option value="NA">NA</option>
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Green (₹)">
              <input type="number" className="input-base" value={form.green} onChange={e => set('green', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Amber (₹)">
              <input type="number" className="input-base" value={form.amber} onChange={e => set('amber', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Blue Sky (₹)">
              <input type="number" className="input-base" value={form.blueSky} onChange={e => set('blueSky', e.target.value)} placeholder="0" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Collected (₹)">
              <input type="number" className="input-base" value={form.collected} onChange={e => set('collected', e.target.value)} placeholder="0" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="May (₹)">
              <input type="number" className="input-base" value={form.mayCol} onChange={e => set('mayCol', e.target.value)} placeholder="0" />
            </Field>
            <Field label="June (₹)">
              <input type="number" className="input-base" value={form.juneCol} onChange={e => set('juneCol', e.target.value)} placeholder="0" />
            </Field>
            <Field label="July (₹)">
              <input type="number" className="input-base" value={form.julyCol} onChange={e => set('julyCol', e.target.value)} placeholder="0" />
            </Field>
          </div>

          <Field label="Remarks">
            <input className="input-base" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Optional" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={createMutation.isPending || !canEdit}
            className="text-sm px-4 py-2 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 transition-colors disabled:opacity-60"
          >
            {createMutation.isPending ? 'Saving…' : 'Save Engagement'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">{label}</label>
      {children}
    </div>
  );
}
