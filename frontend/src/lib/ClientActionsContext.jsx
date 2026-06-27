import React, { createContext, useContext, useState } from 'react';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useEngagements, useUpdateEngagement, useDeleteEngagement, useUpdateRemarks } from '@/hooks/useEngagements';

const ClientActionsContext = createContext(null);

export function ClientActionsProvider({ children }) {
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { data: clients = [], isLoading, isError } = useEngagements(selectedLeaderId, activeFY);
  const updateMutation = useUpdateEngagement(selectedLeaderId, activeFY);
  const deleteMutation = useDeleteEngagement(selectedLeaderId, activeFY);
  const remarksMutation = useUpdateRemarks(selectedLeaderId, activeFY);

  // clientActions are annotation notes per client — not yet a backend entity (Phase 5)
  const [clientActions, setClientActions] = useState([]);

  function addAction(action) {
    setClientActions(prev => [...prev, { ...action, id: Date.now() + Math.random() }]);
  }

  function deleteAction(id) {
    setClientActions(prev => prev.filter(a => a.id !== id));
  }

  function updateActionStatus(id, status) {
    setClientActions(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }

  return (
    <ClientActionsContext.Provider value={{
      clients,
      isLoading,
      isError,
      clientActions,
      addAction,
      deleteAction,
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
