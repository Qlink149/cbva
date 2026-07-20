import React, { createContext, useContext, useMemo, useCallback } from 'react';
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

  const addAction = useCallback(({ clientNum, clientName, description, deadline, engagementId }) => {
    if (!engagementId || !selectedLeaderId || !activeFY) return;
    createAction.mutate({
      engagement_id: engagementId,
      leader_id: selectedLeaderId,
      fiscal_year: activeFY,
      engagement_num: clientNum,
      description,
      deadline: deadline || null,
    });
  }, [createAction, selectedLeaderId, activeFY]);

  const removeAction = useCallback((id) => {
    deleteAction.mutate(id);
  }, [deleteAction]);

  const updateActionStatus = useCallback((id, status) => {
    patchActionStatus.mutate({ id, status });
  }, [patchActionStatus]);

  const updateEngagement = useCallback((vars) => {
    updateMutation.mutate(vars);
  }, [updateMutation]);

  const deleteEngagement = useCallback((id) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const updateRemarks = useCallback((vars) => {
    remarksMutation.mutate(vars);
  }, [remarksMutation]);

  const value = useMemo(() => ({
    clients,
    isLoading,
    isError,
    clientActions: clientActionsWithNames,
    addAction,
    deleteAction: removeAction,
    updateActionStatus,
    updateEngagement,
    deleteEngagement,
    updateRemarks,
    isUpdating: updateMutation.isPending,
  }), [
    clients,
    isLoading,
    isError,
    clientActionsWithNames,
    addAction,
    removeAction,
    updateActionStatus,
    updateEngagement,
    deleteEngagement,
    updateRemarks,
    updateMutation.isPending,
  ]);

  return (
    <ClientActionsContext.Provider value={value}>
      {children}
    </ClientActionsContext.Provider>
  );
}

export function useClientActions() {
  return useContext(ClientActionsContext);
}
