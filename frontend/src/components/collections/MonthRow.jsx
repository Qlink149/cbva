import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR } from '@/lib/formatCurrency';

export default function MonthRow({ month, entries, expectedCollection, engagements, onSaveExpected, onAddEntry, onDeleteEntry, isLocked }) {
  const [open, setOpen] = useState(false);
  const [expectedInput, setExpectedInput] = useState(expectedCollection ?? '');
  const [expectedSaved, setExpectedSaved] = useState(!!expectedCollection);
  const [showAddForm, setShowAddForm] = useState(false);

  // New entry form state
  const [selectedEngId, setSelectedEngId] = useState('');
  const [amountBilled, setAmountBilled] = useState('');
  const [amountCollected, setAmountCollected] = useState('');
  const [saving, setSaving] = useState(false);

  const totalActual = entries.reduce((s, e) => s + (e.actual_collection || 0), 0);
  const expected = Number(expectedInput) || 0;
  const variance = totalActual - expected;

  const selectedEng = engagements.find(e => e.id === selectedEngId);

  const handleSaveExpected = async () => {
    await onSaveExpected(month.key, Number(expectedInput) || 0);
    setExpectedSaved(true);
  };

  const handleAddEntry = async () => {
    if (!selectedEngId || !amountCollected) return;
    setSaving(true);
    await onAddEntry(month.key, {
      engagement_id: selectedEngId,
      client_name: selectedEng?.client_name || '',
      expected_billing: Number(amountBilled) || 0,
      actual_billing: Number(amountBilled) || 0,
      actual_collection: Number(amountCollected) || 0,
    });
    setSelectedEngId('');
    setAmountBilled('');
    setAmountCollected('');
    setShowAddForm(false);
    setSaving(false);
  };

  // Status indicator
  const statusDot = () => {
    if (isLocked) return <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />;
    if (!expected) return <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />;
    if (totalActual >= expected) return <span className="w-2.5 h-2.5 rounded-full bg-status-green flex-shrink-0" />;
    if (totalActual > 0) return <span className="w-2.5 h-2.5 rounded-full bg-status-amber flex-shrink-0" />;
    return <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />;
  };

  return (
    <div className={`rounded-xl border transition-all ${isLocked ? 'opacity-40 pointer-events-none bg-muted/20 border-border/30' : 'bg-card border-border/60 shadow-sm'}`}>
      {/* Header row — always visible */}
      <button
        onClick={() => !isLocked && setOpen(o => !o)}
        disabled={isLocked}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {statusDot()}
          <span className="text-sm font-semibold text-foreground">{month.full}</span>
          {entries.length > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {expected > 0 && (
            <span className="text-xs text-muted-foreground font-tabular hidden sm:block">
              Expected {formatINR(expected)}
            </span>
          )}
          <span className="text-sm font-semibold font-tabular text-foreground">
            {totalActual > 0 ? formatINR(totalActual) : <span className="text-muted-foreground text-xs">{isLocked ? 'Locked' : 'No entries'}</span>}
          </span>
          {variance !== 0 && expected > 0 && totalActual > 0 && (
            <span className={`text-xs font-medium font-tabular px-2 py-0.5 rounded-full ${variance >= 0 ? 'bg-status-green-bg text-status-green' : 'bg-status-red-bg text-status-red'}`}>
              {variance >= 0 ? '▲' : '▼'} {formatINR(Math.abs(variance))}
            </span>
          )}
          {!isLocked && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 px-5 py-5 space-y-5">

              {/* Step 1 — Expected */}
              <div className="rounded-xl bg-muted/40 px-4 py-4 space-y-3">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Step 1 · Set Expected Collection</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={expectedInput}
                    onChange={e => { setExpectedInput(e.target.value); setExpectedSaved(false); }}
                    className="text-2xl font-light font-tabular flex-1 bg-white rounded-lg px-3 py-2 outline-none border border-border/60 focus:border-cbva-navy transition-colors"
                    placeholder="Enter expected amount"
                  />
                  <button
                    onClick={handleSaveExpected}
                    className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors ${
                      expectedSaved ? 'bg-status-green-bg text-status-green' : 'bg-cbva-navy text-white hover:bg-cbva-navy/90'
                    }`}
                  >
                    {expectedSaved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : 'Save'}
                  </button>
                </div>
              </div>

              {/* Step 2 — Entries */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Step 2 · Collection Entries{' '}
                    <span className="normal-case font-tabular font-medium text-foreground">({formatINR(totalActual)} collected)</span>
                  </p>
                  <button
                    onClick={() => setShowAddForm(f => !f)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Entry
                  </button>
                </div>

                {/* Add entry form */}
                <AnimatePresence>
                  {showAddForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl border border-cbva-navy/20 bg-blue-50/40 px-4 py-4 space-y-3">
                        <p className="text-xs font-semibold text-cbva-navy">New Collection Entry</p>

                        {/* Client / Engagement selector */}
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Engagement</label>
                          <select
                            value={selectedEngId}
                            onChange={e => setSelectedEngId(e.target.value)}
                            className="w-full bg-white border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cbva-navy"
                          >
                            <option value="">— Select engagement —</option>
                            {engagements.map(eng => (
                              <option key={eng.id} value={eng.id}>
                                {eng.client_name} · {eng.engagement_type_name || eng.description || eng.status}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedEng && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border/40">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              selectedEng.status === 'Green' ? 'bg-status-green-bg text-status-green' :
                              selectedEng.status === 'Amber' ? 'bg-status-amber-bg text-status-amber' :
                              'bg-blue-100 text-blue-600'
                            }`}>{selectedEng.status}</span>
                            <span className="text-xs text-muted-foreground">Total engagement: {formatINR(selectedEng.amount)}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Amount Billed (₹)</label>
                            <input
                              type="number"
                              value={amountBilled}
                              onChange={e => setAmountBilled(e.target.value)}
                              className="w-full bg-white border border-border/60 rounded-lg px-3 py-2 text-sm font-tabular outline-none focus:border-cbva-navy"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Amount Collected (₹)</label>
                            <input
                              type="number"
                              value={amountCollected}
                              onChange={e => setAmountCollected(e.target.value)}
                              className="w-full bg-white border border-border/60 rounded-lg px-3 py-2 text-sm font-tabular outline-none focus:border-cbva-navy"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleAddEntry}
                            disabled={saving || !selectedEngId || !amountCollected}
                            className="flex-1 bg-cbva-navy text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-cbva-navy/90 disabled:opacity-40 transition-colors"
                          >
                            {saving ? 'Saving...' : 'Add Entry'}
                          </button>
                          <button
                            onClick={() => setShowAddForm(false)}
                            className="px-4 py-2 rounded-lg border border-border/60 text-sm text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Existing entries list */}
                {entries.length > 0 ? (
                  <div className="space-y-2">
                    {entries.map((entry, i) => (
                      <div key={entry.id || i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/30 border border-border/40">
                        <div>
                          <p className="text-sm font-medium text-foreground">{entry.client_name || '—'}</p>
                          <p className="text-xs text-muted-foreground">
                            Billed {formatINR(entry.actual_billing || 0)} · Collected {formatINR(entry.actual_collection || 0)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold font-tabular text-foreground">{formatINR(entry.actual_collection)}</span>
                          <button
                            onClick={() => onDeleteEntry(entry.id)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Running total */}
                    <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-cbva-navy/5 border border-cbva-navy/10">
                      <span className="text-xs font-semibold text-cbva-navy uppercase tracking-wider">Total Collected</span>
                      <span className="text-base font-bold font-tabular text-cbva-navy">{formatINR(totalActual)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-4">No entries yet — click Add Entry to log a collection</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}