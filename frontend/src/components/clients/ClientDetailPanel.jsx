import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatINR } from '@/lib/formatCurrency';
import { Building2, Tag, Globe, CalendarDays, FileText, TrendingUp, Users2 } from 'lucide-react';

const STATUS_COLORS = {
  Active: 'bg-status-green-bg text-status-green',
  Dormant: 'bg-muted text-muted-foreground',
  Lost: 'bg-status-red-bg text-status-red',
  Prospect: 'bg-status-amber-bg text-status-amber',
};

const ENG_STATUS_COLORS = {
  Green: 'bg-status-green-bg text-status-green',
  Amber: 'bg-status-amber-bg text-status-amber',
  'Blue Sky': 'bg-status-blue-bg text-status-blue',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function ClientDetailPanel({ client, engagements, onClose }) {
  if (!client) return null;

  const clientEngs = engagements.filter(e => e.client_id === client.id);
  const totalPipeline = clientEngs.reduce((s, e) => s + (e.amount || 0), 0);
  const green = clientEngs.filter(e => e.status === 'Green').reduce((s, e) => s + (e.amount || 0), 0);
  const amber = clientEngs.filter(e => e.status === 'Amber').reduce((s, e) => s + (e.amount || 0), 0);
  const blueSky = clientEngs.filter(e => e.status === 'Blue Sky').reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <Sheet open={!!client} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-semibold text-foreground leading-tight">{client.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[client.status] || 'bg-muted text-muted-foreground'}`}>
                  {client.status || 'Active'}
                </span>
                {client.type && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{client.type}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Pipeline Summary */}
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Pipeline Summary
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Total Pipeline</p>
                <p className="text-lg font-semibold font-tabular text-foreground">{formatINR(totalPipeline)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Engagements</p>
                <p className="text-lg font-semibold text-foreground">{clientEngs.length}</p>
              </div>
            </div>
            {totalPipeline > 0 && (
              <div className="mt-3 space-y-1.5">
                {green > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-status-green font-medium">Green</span>
                    <span className="font-tabular font-medium">{formatINR(green)}</span>
                  </div>
                )}
                {amber > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-status-amber font-medium">Amber</span>
                    <span className="font-tabular font-medium">{formatINR(amber)}</span>
                  </div>
                )}
                {blueSky > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-status-blue font-medium">Blue Sky</span>
                    <span className="font-tabular font-medium">{formatINR(blueSky)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Client Details */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Client Info</p>
            <div className="bg-card rounded-xl border border-border/60 px-4">
              <InfoRow icon={Tag} label="Type" value={client.type} />
              <InfoRow icon={Globe} label="Industry" value={client.primary_industry} />
              <InfoRow icon={CalendarDays} label="Onboarded" value={formatDate(client.date_onboarded)} />
              <InfoRow icon={CalendarDays} label="Next Meeting" value={formatDate(client.next_meeting_date)} />
              {client.notes && <InfoRow icon={FileText} label="Notes" value={client.notes} />}
            </div>
          </div>

          {/* Engagements List */}
          {clientEngs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users2 className="w-3 h-3" /> Engagements ({clientEngs.length})
              </p>
              <div className="space-y-2">
                {clientEngs.map(eng => (
                  <div key={eng.id} className="bg-card rounded-xl border border-border/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ENG_STATUS_COLORS[eng.status] || 'bg-muted text-muted-foreground'}`}>
                            {eng.status}{eng.blue_sky_subtype ? ` · ${eng.blue_sky_subtype}` : ''}
                          </span>
                          {eng.engagement_type_name && (
                            <span className="text-[10px] text-muted-foreground">{eng.engagement_type_name}</span>
                          )}
                          {eng.el_signed === 'Signed' && (
                            <span className="text-[10px] bg-status-green-bg text-status-green px-1.5 py-0.5 rounded-full">EL Signed</span>
                          )}
                        </div>
                        {eng.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{eng.description}</p>
                        )}
                        {eng.person_responsible_name && (
                          <p className="text-[10px] text-muted-foreground mt-1">Person: {eng.person_responsible_name}</p>
                        )}
                        {eng.remarks && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 italic">{eng.remarks}</p>
                        )}
                      </div>
                      <p className="text-sm font-semibold font-tabular text-foreground shrink-0">{formatINR(eng.amount || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clientEngs.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm bg-muted/20 rounded-xl">
              No engagements found for this client.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}