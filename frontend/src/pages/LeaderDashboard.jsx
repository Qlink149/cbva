import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

import PipelineBoardChart from '@/components/dashboard/PipelineBoardChart';
import BlueSkyTableReal from '@/components/dashboard/BlueSkyTableReal';
import MonthlyEvolutionCard from '@/components/dashboard/MonthlyEvolutionCard';
import CollectionsTableReal from '@/components/dashboard/CollectionsTableReal';
import TeamMetrics from '@/components/dashboard/TeamMetrics';
import ELStatusWidgets from '@/components/dashboard/ELStatusWidgets';
import PlaceholderCard from '@/components/dashboard/PlaceholderCard';
import ELSummaryChips from '@/components/dashboard/ELSummaryChips';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { usePipeline } from '@/hooks/usePipeline';
import { useBluesky } from '@/hooks/useBluesky';
import { useCollections } from '@/hooks/useCollections';
import { useElSummary } from '@/hooks/useElSummary';
import { useHiring } from '@/hooks/useHiring';
import { useEngagements } from '@/hooks/useEngagements';
import { useTeam } from '@/hooks/useTeam';

export default function LeaderDashboard({ user }) {
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const { data: pipelineRes, isLoading: pipelineLoading } = usePipeline(selectedLeaderId, activeFY);
  const { data: blueSkyRes, isLoading: bsLoading } = useBluesky(selectedLeaderId, activeFY);
  const { data: collectionsRes, isLoading: colLoading } = useCollections(selectedLeaderId, activeFY);
  const { data: engagementsRes, isLoading: engLoading } = useEngagements(selectedLeaderId, activeFY);
  const { hiringReqs, isLoading: hiringLoading } = useHiring(selectedLeaderId);
  const { teamMembers, isLoading: teamLoading } = useTeam(selectedLeaderId);
  const { data: elSummary } = useElSummary(selectedLeaderId, activeFY);

  const isLoading = pipelineLoading || bsLoading || colLoading || engLoading || hiringLoading || teamLoading;

  const pipelineData = pipelineRes?.data ?? [];
  const blueSkyRows = blueSkyRes?.data ?? [];
  const blueSkyTotals = blueSkyRes?.totals ?? {};
  const collectionRows = collectionsRes?.data ?? [];
  const totalCollected = collectionsRes?.total_collected ?? 0;
  const clients = engagementsRes ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (pipelineData.length === 0) {
    return (
      <div className="min-h-full pb-12">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-2">
              <LeaderFYSelector />
              <p className="text-sm text-muted-foreground">
                Business Leader · {fyLabel} Overview
              </p>
            </div>
            <img
              src="https://media.base44.com/images/public/69fe2ae7dcf5259c46299cee/e5b8e8806_CBV_Logo1.png"
              alt="CBV & Associates LLP"
              className="h-28 object-contain"
            />
          </div>
          <div className="executive-card rounded-2xl border-dashed p-16 text-center">
            <p className="text-lg font-semibold text-muted-foreground">{selectedLeaderId}</p>
            <p className="text-sm text-muted-foreground mt-2">
              No pipeline data for {fyLabel}. Data will appear once imported.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-12">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <LeaderFYSelector />
            <p className="text-sm text-muted-foreground">
              Business Leader · {fyLabel} Overview
            </p>
          </div>
          <img
            src="https://media.base44.com/images/public/69fe2ae7dcf5259c46299cee/e5b8e8806_CBV_Logo1.png"
            alt="CBV & Associates LLP"
            className="h-28 object-contain"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 xl:col-span-4">
            <PipelineBoardChart pipelineData={pipelineData} fyLabel={fyLabel} />
          </div>
          <div className="lg:col-span-7 xl:col-span-8">
            <MonthlyEvolutionCard pipelineData={pipelineData} fyLabel={fyLabel} />
          </div>
        </div>

        <ELSummaryChips summary={elSummary} fyLabel={fyLabel} />

        <BlueSkyTableReal blueSkyRows={blueSkyRows} totals={blueSkyTotals} fyLabel={fyLabel} />

        <CollectionsTableReal rows={collectionRows} totalCollected={totalCollected} fyLabel={fyLabel} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlaceholderCard title="Shadow P&L" message="To Be Built — Revenue split by engagement leaders. Coming in the next phase." />
          <PlaceholderCard title="Origination" message="To Be Built — Partner origination tracking. Coming in the next phase." />
        </div>

        {clients.length > 0 && <ELStatusWidgets clients={clients} />}

        <TeamMetrics hiringReqs={hiringReqs} teamMembers={teamMembers} />
      </div>
    </div>
  );
}
