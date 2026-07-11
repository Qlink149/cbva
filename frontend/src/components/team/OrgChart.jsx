import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamHierarchyFlowBoard } from '@/components/team/TeamHierarchyFlowBoard';
import { buildLeaderHierarchy, buildFirmwideHierarchy } from '@/lib/teamHierarchy';

export default function OrgChart({
  mode = 'leader',
  leaderId,
  leaderName,
  teamMembers = [],
  hiringReqs = [],
  leaders = [],
}) {
  const [open, setOpen] = useState(false);

  const hierarchy = useMemo(() => {
    if (mode === 'firmwide') {
      return buildFirmwideHierarchy({ leaders, teamMembers, hiringReqs });
    }
    return buildLeaderHierarchy({ leaderId, leaderName, teamMembers, hiringReqs });
  }, [mode, leaderId, leaderName, teamMembers, hiringReqs, leaders]);

  const memberCount = hierarchy.allMembers?.length ?? teamMembers.length;
  const subtitle = mode === 'firmwide'
    ? 'Full firm reporting hierarchy across all leaders'
    : 'Reporting hierarchies mapped per leader';

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Network className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">Organisational Structure</p>
            <p className="text-sm text-muted-foreground italic truncate">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </span>
          {open
            ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
            : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <TeamHierarchyFlowBoard
                hierarchy={hierarchy}
                title="Organisational Structure"
                subtitle={mode === 'firmwide' ? hierarchy.rootSubtitle : `Reporting lines for ${leaderName || leaderId}`}
                mode={mode}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
