import React from 'react';
import EngagementsTable from '@/components/clients/EngagementsTable';
import ManualEntryToggle from '@/components/shared/ManualEntryToggle';
import { useClientActions } from '@/lib/ClientActionsContext';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useLeader } from '@/hooks/useLeaders';
import { useFyEditAccess } from '@/hooks/useFyEditAccess';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';
import { getFyLabel } from '@/lib/fiscalYear';
import { Skeleton } from '@/components/ui/skeleton';

export default function Clients({ user }) {
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const { data: leader } = useLeader(selectedLeaderId);
  const { clients, isLoading } = useClientActions();
  const { canEdit: fyCanEdit } = useFyEditAccess();
  const fyLabel = getFyLabel(activeFY, fiscalYears);
  const canEdit = fyCanEdit && activeFY !== '2526';

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Engagements</h1>
          {isLoading ? (
            <Skeleton className="h-4 w-48 mt-2" />
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {activeFY === '2526'
                ? `${fyLabel} · Month-level view${leader?.name ? ` · ${leader.name}` : ''}`
                : `${fyLabel} · ${clients.length} clients${leader?.name ? ` · ${leader.name}` : ''}`}
            </p>
          )}
        </div>
        <LeaderFYSelector />
      </div>

      <ManualEntryToggle
        leaderId={selectedLeaderId}
        fiscalYear={activeFY}
        entryType="new_client"
        sourceTab="engagements"
        canEdit={canEdit}
        label="Add entry"
      />

      <EngagementsTable key={`${selectedLeaderId}-${activeFY}`} fiscalYear={activeFY} fyLabel={fyLabel} />
    </div>
  );
}
