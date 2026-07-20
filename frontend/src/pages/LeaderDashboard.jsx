import React, { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

import PipelineBoardChart from '@/components/dashboard/PipelineBoardChart';
import BlueSkyTableReal from '@/components/dashboard/BlueSkyTableReal';
import MonthlyEvolutionCard from '@/components/dashboard/MonthlyEvolutionCard';
import CollectionsTableReal from '@/components/dashboard/CollectionsTableReal';
import MeetingsCard from '@/components/dashboard/MeetingsCard';
import ActionsCard from '@/components/dashboard/ActionsCard';
import TeamMetrics from '@/components/dashboard/TeamMetrics';
import PlaceholderCard from '@/components/dashboard/PlaceholderCard';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel, getPrevFySlug, getFyRange } from '@/lib/fiscalYear';
import { usePipeline } from '@/hooks/usePipeline';
import { useBluesky, useUpdateBluesky } from '@/hooks/useBluesky';
import { useCollections, useUpdateCollectionRemarks } from '@/hooks/useCollections';
import { useClientMeetings } from '@/hooks/useClientMeetings';
import { useActions } from '@/hooks/useActions';
import { useHiring } from '@/hooks/useHiring';
import { useEngagements } from '@/hooks/useEngagements';
import { useTeam } from '@/hooks/useTeam';
import { useHeadcount } from '@/hooks/useHeadcount';
import { useBaselines } from '@/hooks/useBaselines';
import { useConsolidated } from '@/hooks/useConsolidated';

const ELStatusWidgets = lazy(() => import('@/components/dashboard/ELStatusWidgets'));

function SectionSkeleton({ className = 'h-48' }) {
  return <Skeleton className={`w-full ${className}`} />;
}

export default function LeaderDashboard({ user }) {
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const { data: pipelineRes, isLoading: pipelineLoading } = usePipeline(selectedLeaderId, activeFY);
  const { data: blueSkyRes, isLoading: bsLoading } = useBluesky(selectedLeaderId, activeFY);
  const updateBluesky = useUpdateBluesky(selectedLeaderId, activeFY);
  const { data: collectionsRes, isLoading: colLoading } = useCollections(selectedLeaderId, activeFY);
  const updateCollectionRemarks = useUpdateCollectionRemarks(selectedLeaderId, activeFY);
  const { data: engagementsRes, isLoading: engLoading } = useEngagements(selectedLeaderId, activeFY);
  const { hiringReqs, isLoading: hiringLoading } = useHiring(selectedLeaderId, activeFY);
  const { teamMembers, isLoading: teamLoading } = useTeam(selectedLeaderId, activeFY);
  const { approvedByDesignation } = useHeadcount(selectedLeaderId, activeFY);
  const { data: meetings = [], isLoading: meetingsLoading } = useClientMeetings(selectedLeaderId, activeFY);
  const { data: leaderActions = [], isLoading: actionsLoading } = useActions(selectedLeaderId, activeFY);
  const { data: baselines = [] } = useBaselines(selectedLeaderId);
  const activeBaseline = baselines[0] ?? null;
  const { rows: consolidatedRows, columns: consolidatedColumns } = useConsolidated(activeFY);

  const prevFySlug = getPrevFySlug(activeFY, fiscalYears);
  const prevFyLabel = getFyLabel(prevFySlug, fiscalYears);

  const coreLoading = pipelineLoading || bsLoading || colLoading;

  const pipelineData = pipelineRes?.data ?? [];
  // Previous-FY actuals come from the labelled reference row embedded in the
  // current FY's pipeline snapshots (same source as the Monthly Plan Evolution),
  // matched dynamically to the previous FY so it works for any year.
  const prevFyRange = getFyRange(prevFySlug);
  const prevFyRow = prevFyRange
    ? pipelineData.find((r) => (r.label || '').replace(/–/g, '-').includes(prevFyRange))
    : null;
  const prevFyBlueSky = prevFyRow?.blueSky ?? null;
  const prevFyTotal = prevFyRow
    ? prevFyRow.total || ((prevFyRow.green || 0) + (prevFyRow.amber || 0) + (prevFyRow.blueSky || 0))
    : null;

  const blueSkyRows = blueSkyRes?.data ?? [];
  const blueSkyTotals = blueSkyRes?.totals ?? {};
  const collectionRows = collectionsRes?.data ?? [];
  const totalCollected = collectionsRes?.total_collected ?? 0;
  const clients = engagementsRes ?? [];
  const hasEngagements = clients.length > 0;

  if (coreLoading && pipelineData.length === 0 && !hasEngagements) {
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

  if (pipelineData.length === 0 && !hasEngagements) {
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

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-5 min-w-0">
            {pipelineLoading ? <SectionSkeleton className="h-72" /> : (
              <PipelineBoardChart
                pipelineData={pipelineData}
                fyLabel={fyLabel}
                fySlug={activeFY}
                leaderId={selectedLeaderId}
                baseline={activeBaseline}
                prevFyBlueSky={prevFyBlueSky}
                prevFyTotal={prevFyTotal}
                prevFyLabel={prevFyLabel}
              />
            )}
          </div>
          <div className="xl:col-span-7 min-w-0">
            {pipelineLoading ? <SectionSkeleton className="h-72" /> : (
              <MonthlyEvolutionCard
                pipelineData={pipelineData}
                fyLabel={fyLabel}
                fySlug={activeFY}
                leaderId={selectedLeaderId}
                consolidatedRows={consolidatedRows}
                consolidatedColumns={consolidatedColumns}
              />
            )}
          </div>
        </div>

        {bsLoading ? <SectionSkeleton className="h-64" /> : (
          <BlueSkyTableReal
            blueSkyRows={blueSkyRows}
            totals={blueSkyTotals}
            fyLabel={fyLabel}
            onUpdateRemarks={(row, remarks) =>
              updateBluesky.mutate({
                entryId: row.id,
                monthKey: row.month_key,
                remarks,
              })
            }
            onUpdateAmounts={(row, amounts) =>
              updateBluesky.mutate({
                entryId: row.id,
                monthKey: row.month_key,
                ...amounts,
              })
            }
          />        )}

        {colLoading ? <SectionSkeleton className="h-64" /> : (
          <CollectionsTableReal
            rows={collectionRows}
            totalCollected={totalCollected}
            fyLabel={fyLabel}
            fySlug={activeFY}
            onUpdateRemarks={(row, remarks) => updateCollectionRemarks.mutate({ row, remarks })}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MeetingsCard meetings={meetings} fyLabel={fyLabel} isLoading={meetingsLoading} />
          <ActionsCard actions={leaderActions} fyLabel={fyLabel} isLoading={actionsLoading} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlaceholderCard title="Shadow P&L" message="To Be Built — Revenue split by engagement leaders. Coming in the next phase." />
          <PlaceholderCard title="Origination" message="To Be Built — Partner origination tracking. Coming in the next phase." />
        </div>

        {engLoading ? <SectionSkeleton className="h-56" /> : clients.length > 0 && (
          <Suspense fallback={<SectionSkeleton className="h-56" />}>
            <ELStatusWidgets clients={clients} />
          </Suspense>
        )}

        {hiringLoading || teamLoading ? (
          <SectionSkeleton className="h-48" />
        ) : (
          <TeamMetrics hiringReqs={hiringReqs} teamMembers={teamMembers} approvedByDesignation={approvedByDesignation} />
        )}
      </div>
    </div>
  );
}
