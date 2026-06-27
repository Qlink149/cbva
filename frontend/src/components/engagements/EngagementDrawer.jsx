import React, { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminClients, useAdminEngagementTypes } from '@/hooks/useAdmin';
import { Paperclip, CheckCircle2, Loader2, ExternalLink, X } from 'lucide-react';

export default function EngagementDrawer({ open, onClose, onSave, engagement, leaderId, fyId }) {
  const fileInputRef = useRef(null);
  const [uploadingEL, setUploadingEL] = useState(false);
  const [elDocUrl, setElDocUrl] = useState('');
  const { data: clients = [] } = useAdminClients();
  const { data: engTypes = [] } = useAdminEngagementTypes();

  const [form, setForm] = useState({
    client_id: '', client_name: '', engagement_type_id: '', engagement_type_name: '',
    description: '', status: 'Blue Sky', blue_sky_subtype: 'Identified',
    amount: '', el_signed: 'NA', remarks: '', person_responsible_id: leaderId,
    person_responsible_name: '', origination_partner_id: leaderId,
    origination_partner_name: '', management_oversight: '',
  });

  useEffect(() => {
    setElDocUrl('');
    if (engagement) {
      setElDocUrl(engagement.el_document_url || '');
      setForm({
        client_id: engagement.client_id || '',
        client_name: engagement.client_name || '',
        engagement_type_id: engagement.engagement_type_id || '',
        engagement_type_name: engagement.engagement_type_name || '',
        description: engagement.description || '',
        status: engagement.status || 'Blue Sky',
        blue_sky_subtype: engagement.blue_sky_subtype || 'Identified',
        amount: engagement.amount || '',
        el_signed: engagement.el_signed || 'NA',
        remarks: engagement.remarks || '',
        person_responsible_id: engagement.person_responsible_id || leaderId,
        person_responsible_name: engagement.person_responsible_name || '',
        origination_partner_id: engagement.origination_partner_id || leaderId,
        origination_partner_name: engagement.origination_partner_name || '',
        management_oversight: engagement.management_oversight || '',
      });
    } else {
      setForm(prev => ({ ...prev, client_id: '', client_name: '', engagement_type_id: '', engagement_type_name: '', description: '', status: 'Blue Sky', blue_sky_subtype: 'Identified', amount: '', el_signed: 'NA', remarks: '', management_oversight: '' }));
    }
  }, [engagement, leaderId]);

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setForm(prev => ({ ...prev, client_id: clientId, client_name: client?.name || '' }));
  };

  const handleTypeChange = (typeId) => {
    const type = engTypes.find(t => t.id === typeId);
    setForm(prev => ({ ...prev, engagement_type_id: typeId, engagement_type_name: type?.name || '' }));
  };

  const handleStatusChange = (status) => {
    const el = status === 'Blue Sky' ? 'NA' : 'Not Signed';
    const subtype = status === 'Blue Sky' ? (form.blue_sky_subtype || 'Identified') : undefined;
    setForm(prev => ({ ...prev, status, el_signed: el, blue_sky_subtype: subtype }));
  };

  const handleELUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingEL(true);
    // File upload requires server-side storage — store filename locally for now
    setElDocUrl(file.name);
    setUploadingEL(false);
  };

  const handleSubmit = () => {
    onSave({
      ...form,
      amount: parseFloat(form.amount) || 0,
      financial_year_id: fyId,
      leader_id: leaderId,
      person_responsible_name: form.person_responsible_name,
      origination_partner_name: form.origination_partner_name,
      el_document_url: elDocUrl || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{engagement ? 'Edit Engagement' : 'New Engagement'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label>Client *</Label>
            <Select value={form.client_id} onValueChange={handleClientChange}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Engagement Type</Label>
            <Select value={form.engagement_type_id} onValueChange={handleTypeChange}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {engTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status *</Label>
              <Select value={form.status} onValueChange={handleStatusChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Green">Green</SelectItem>
                  <SelectItem value="Amber">Amber</SelectItem>
                  <SelectItem value="Blue Sky">Blue Sky</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="0" />
            </div>
          </div>
          {form.status === 'Blue Sky' && (
            <div>
              <Label>Blue Sky Subtype</Label>
              <Select value={form.blue_sky_subtype} onValueChange={v => setForm(prev => ({ ...prev, blue_sky_subtype: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Identified">Identified</SelectItem>
                  <SelectItem value="Unidentified">Unidentified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>EL Signed</Label>
            <Select value={form.el_signed} onValueChange={v => setForm(prev => ({ ...prev, el_signed: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Signed">✓ Signed</SelectItem>
                <SelectItem value="Not Signed">✗ Not Signed</SelectItem>
                <SelectItem value="NA">— NA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* EL Document Upload */}
          {form.el_signed === 'Signed' && (
            <div>
              <Label>EL Document</Label>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg" className="hidden" onChange={handleELUpload} />
              {elDocUrl ? (
                <div className="flex items-center gap-2 mt-1 p-2.5 rounded-lg border border-status-green/40 bg-status-green-bg/30">
                  <CheckCircle2 className="w-4 h-4 text-status-green shrink-0" />
                  <span className="text-xs text-status-green font-medium flex-1 truncate">EL uploaded</span>
                  <a href={elDocUrl} target="_blank" rel="noopener noreferrer" className="text-status-green hover:opacity-70">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => setElDocUrl('')} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingEL}
                  className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-cbva-navy/40 hover:bg-muted/30 transition-colors text-sm text-muted-foreground"
                >
                  {uploadingEL ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  {uploadingEL ? 'Uploading...' : 'Attach signed EL (PDF, Word, Image)'}
                </button>
              )}
            </div>
          )}
          <div>
            <Label>Person Responsible</Label>
            <Input value={form.person_responsible_name} onChange={e => setForm(prev => ({ ...prev, person_responsible_name: e.target.value }))} placeholder="Name" />
          </div>
          <div>
            <Label>Origination Partner</Label>
            <Input value={form.origination_partner_name} onChange={e => setForm(prev => ({ ...prev, origination_partner_name: e.target.value }))} placeholder="Name" />
          </div>
          <div>
            <Label>Mgmt Oversight</Label>
            <Input value={form.management_oversight} onChange={e => setForm(prev => ({ ...prev, management_oversight: e.target.value }))} placeholder="e.g. KK, BDC" />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))} rows={3} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} className="flex-1 bg-cbva-navy hover:bg-cbva-navy/90">
              {engagement ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}