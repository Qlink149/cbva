import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { isFyEditable } from '@/lib/fiscalYear';

/** Shared FY edit gate — admins always editable; others follow Admin "Editable" toggle. */
export function useFyEditAccess() {
  const { user } = useAuth();
  const { activeFY, fiscalYears, fyLoading } = useGlobalSelector();

  const canEdit = useMemo(
    () => isFyEditable(activeFY, fiscalYears, user?.role),
    [activeFY, fiscalYears, user?.role],
  );

  const lockedMessage = 'This fiscal year is locked for editing. Ask an admin to enable it in Admin Settings.';

  return { canEdit, activeFY, fyLoading, lockedMessage };
}
