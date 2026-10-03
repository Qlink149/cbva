import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useEngagements, useUpdateEngagement, useDeleteEngagement, useUpdateRemarks } from '@/hooks/useEngagements';
import { useEngagementActions } from '@/hooks/useEngagementMeta';
import { toast } from 'sonner';

const ClientActionsContext = createContext(null);

export function ClientActionsProvider({ children }) {
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { data: clients = [], isLoading, isError } = useEngagements(selectedLeaderId, activeFY);
  const updateMutation = useUpdateEngagement(selectedLeaderId, activeFY);
  const deleteMutation = useDeleteEngagement(selectedLeaderId, activeFY);
  const remarksMutation = useUpdateRemarks(selectedLeaderId, activeFY);

  const {
    actions: clientActions,
    isLoading: actionsLoading,
    createAction,
    deleteAction,
    patchActionStatus,
    patchAction,
  } = useEngagementActions(selectedLeaderId, activeFY);

  const clientNameById = useMemo(() => {
    const map = new Map();
    clients.forEach((c) => map.set(String(c.id), c.name));
    return map;
  }, [clients]);

  const clientNameByNum = useMemo(() => {
    const map = new Map();
    clients.forEach((c) => map.set(c.num, c.name));
    return map;
  }, [clients]);

  const clientActionsWithNames = useMemo(
    () => clientActions.map((a) => ({
      ...a,
      clientName:
        a.clientName
        || clientNameById.get(String(a.engagementId))
        || clientNameByNum.get(a.clientNum)
        || '',
    })),
    [clientActions, clientNameById, clientNameByNum],
  );

  const addAction = useCallback(async ({ clientNum, description, deadline, engagementId, remarks }) => {
    if (!engagementId || !selectedLeaderId || !activeFY) {
      toast.error('Cannot add action point — missing client or year.');
      throw new Error('missing client or year');
    }
    const body = {
      engagement_id: engagementId,
      leader_id: selectedLeaderId,
      fiscal_year: activeFY,
      description,
      deadline: deadline || null,
      remarks: remarks || '',
    };
    const num = Number(clientNum);
    if (Number.isFinite(num)) body.engagement_num = num;
    return createAction.mutateAsync(body);
  }, [createAction, selectedLeaderId, activeFY]);

  const removeAction = useCallback((id) => {
    deleteAction.mutate(id);
  }, [deleteAction]);

  const updateActionStatus = useCallback((id, status) => {
    patchActionStatus.mutate({ id, status });
  }, [patchActionStatus]);

  const updateAction = useCallback((id, fields) => {
    patchAction.mutate({ id, ...fields });
  }, [patchAction]);

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
    actionsLoading,
    clientActions: clientActionsWithNames,
    addAction,
    deleteAction: removeAction,
    updateActionStatus,
    updateAction,
    updateEngagement,
    deleteEngagement,
    updateRemarks,
    isUpdating: updateMutation.isPending,
    isAddingAction: createAction.isPending,
  }), [
    clients,
    isLoading,
    isError,
    actionsLoading,
    clientActionsWithNames,
    addAction,
    removeAction,
    updateActionStatus,
    updateAction,
    updateEngagement,
    deleteEngagement,
    updateRemarks,
    updateMutation.isPending,
    createAction.isPending,
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
