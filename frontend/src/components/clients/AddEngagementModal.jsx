import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useCreateEngagement } from '@/hooks/useEngagements';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useTeam } from '@/hooks/useTeam';
import { relationshipPartnerList } from '@/lib/relationshipPartners';

const L = 100000;

const DEFAULT_FORM = {
  name: '',
  manager: '',
  relPartner: '',
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

function parseNum(val) {
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * L);
}

export default function AddEngagementModal({ onClose, nextNum, partnerOptions = [] }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [partnerDropdownOpen, setPartnerDropdownOpen] = useState(false);
  const partnerDropdownRef = useRef(null);
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { teamMembers } = useTeam(selectedLeaderId);
  const createMutation = useCreateEngagement();

  const managerSuggestions = [...new Set(teamMembers.map(m => m.full_name).filter(Boolean))].sort();

  const selectedPartners = relationshipPartnerList(form.relPartner);

  useEffect(() => {
    function handleClickOutside(event) {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(event.target)) {
        setPartnerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      onError: () => setError('Failed to save. Please try again.'),
    });
  }

  function togglePartner(partner) {
    const next = selectedPartners.includes(partner)
      ? selectedPartners.filter(p => p !== partner)
      : [...selectedPartners, partner];
    set('relPartner', next.join(', '));
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
            <input
              className="input-base"
              list="add-engagement-manager-suggestions"
              value={form.manager}
              onChange={e => set('manager', e.target.value)}
              placeholder="Name of manager"
            />
            {managerSuggestions.length > 0 && (
              <datalist id="add-engagement-manager-suggestions">
                {managerSuggestions.map(name => <option key={name} value={name} />)}
              </datalist>
            )}
          </Field>

          <Field label="Rel. Partner">
            <div className="relative" ref={partnerDropdownRef}>
              <button
                type="button"
                className="input-base flex items-center justify-between text-left"
                onClick={() => setPartnerDropdownOpen(open => !open)}
              >
                <span className={`truncate ${selectedPartners.length ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {selectedPartners.length === 0 ? 'Select relationship partners' : selectedPartners.join(', ')}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${partnerDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {partnerDropdownOpen && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-xl">
                  {partnerOptions.length === 0 && (
                    <div className="px-3 py-2.5 text-xs italic text-muted-foreground">
                      No partners available yet.
                    </div>
                  )}
                  {partnerOptions.map(partner => {
                    const active = selectedPartners.includes(partner);
                    return (
                      <label key={partner} className="flex cursor-pointer items-center gap-2.5 border-b border-border/40 px-3 py-2.5 text-xs last:border-0 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => togglePartner(partner)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-cbva-navy focus:ring-cbva-navy/30"
                        />
                        <span className="truncate">{partner}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>

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

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={createMutation.isPending}
            className="text-sm px-5 py-2 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 transition-colors font-medium disabled:opacity-60"
          >
            {createMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          font-size: 13px;
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 6px 10px;
          background: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-base:focus {
          border-color: hsl(var(--ring));
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
