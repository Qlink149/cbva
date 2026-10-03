import { useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useFyEditAccess } from '@/hooks/useFyEditAccess';
import { isMonthLocked } from '@/lib/fyCalendar';
import { getCurrentMonthKey } from '@/lib/fyMonths';

/** Month-level edit gate for status/projection fields — layered on FY lock. */
export function useMonthEditAccess() {
  const { user } = useAuth();
  const { activeFY } = useGlobalSelector();
  const { canEdit, lockedMessage } = useFyEditAccess();
  const isAdmin = user?.role === 'admin';

  const monthLockedMessage =
    "This month's status and projections are locked. Data freezes on the 20th of the following month.";

  const isMonthLockedFor = useCallback(
    (monthKey) => isMonthLocked(activeFY, monthKey, { isAdmin }),
    [activeFY, isAdmin],
  );

  const canEditMonth = useCallback(
    (monthKey) => canEdit && !isMonthLockedFor(monthKey),
    [canEdit, isMonthLockedFor],
  );

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  const canEditStatus = canEditMonth(currentMonthKey);

  const guardMonthEdit = useCallback(
    (monthKey, action) => {
      if (!canEdit) {
        return lockedMessage;
      }
      if (isMonthLockedFor(monthKey)) {
        return monthLockedMessage;
      }
      action();
      return null;
    },
    [canEdit, isMonthLockedFor, lockedMessage, monthLockedMessage],
  );

  return {
    canEditStatus,
    canEditMonth,
    isMonthLockedFor,
    currentMonthKey,
    guardMonthEdit,
    monthLockedMessage,
  };
}
