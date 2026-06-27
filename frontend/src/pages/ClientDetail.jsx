import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/formatCurrency';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useEngagements } from '@/hooks/useEngagements';

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { data: engagements = [], isLoading } = useEngagements(selectedLeaderId, activeFY);

  const client = engagements.find(e => e.id === clientId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <p className="text-muted-foreground">Client not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      <div>
        <h1 className="text-3xl font-light text-foreground">{client.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{client.model} · EL: {client.elStatus}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Green', value: client.green },
          { label: 'Amber', value: client.amber },
          { label: 'Blue Sky', value: client.blueSky },
          { label: 'Collected', value: client.collected },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-semibold font-tabular">{formatINR(s.value || 0)}</p>
          </div>
        ))}
      </div>
      {client.remarks && (
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Remarks</p>
          <p className="text-sm">{client.remarks}</p>
        </div>
      )}
    </div>
  );
}
