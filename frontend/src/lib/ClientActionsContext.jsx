import React, { createContext, useContext, useMemo } from 'react';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useEngagements, useUpdateEngagement, useDeleteEngagement, useUpdateRemarks } from '@/hooks/useEngagements';
import { useEngagementActions } from '@/hooks/useEngagementMeta';

const ClientActionsContext = createContext(null);

export function ClientActionsProvider({ children }) {
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { data: clients = [], isLoading, isError } = useEngagements(selectedLeaderId, activeFY);
  const updateMutation = useUpdateEngagement(selectedLeaderId, activeFY);
  const deleteMutation = useDeleteEngagement(selectedLeaderId, activeFY);
  const remarksMutation = useUpdateRemarks(selectedLeaderId, activeFY);

  const {
    actions: clientActions,
    createAction,
    deleteAction,
    patchActionStatus,
  } = useEngagementActions(selectedLeaderId, activeFY);

  const clientNameByNum = useMemo(() => {
    const map = new Map();
    clients.forEach((c) => map.set(c.num, c.name));
    return map;
  }, [clients]);

  const clientActionsWithNames = useMemo(
    () => clientActions.map((a) => ({
      ...a,
      clientName: clientNameByNum.get(a.clientNum) || a.clientName || '',
    })),
    [clientActions, clientNameByNum],
  );

  function addAction({ clientNum, clientName, description, deadline, engagementId }) {
    if (!engagementId || !selectedLeaderId || !activeFY) return;
    createAction.mutate({
      engagement_id: engagementId,
      leader_id: selectedLeaderId,
      fiscal_year: activeFY,
      engagement_num: clientNum,
      description,
      deadline: deadline || null,
    });
  }

  function removeAction(id) {
    deleteAction.mutate(id);
  }

  function updateActionStatus(id, status) {
    patchActionStatus.mutate({ id, status });
  }

  return (
    <ClientActionsContext.Provider value={{
      clients,
      isLoading,
      isError,
      clientActions: clientActionsWithNames,
      addAction,
      deleteAction: removeAction,
      updateActionStatus,
      updateEngagement: updateMutation.mutate,
      deleteEngagement: deleteMutation.mutate,
      updateRemarks: remarksMutation.mutate,
    }}>
      {children}
    </ClientActionsContext.Provider>
  );
}

export function useClientActions() {
  return useContext(ClientActionsContext);
}
