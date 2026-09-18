import { useState, useEffect, useCallback, useRef } from 'react';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { buildScopedKey, readScopedJson, writeScopedJson } from '@/lib/pageFilterStorage';

/**
 * Persist state in sessionStorage scoped by leader + FY.
 * Re-reads when leader or FY changes; writes on every setState.
 */
export function useLeaderFyScopedState(scope, getDefault, { validate } = {}) {
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const key = buildScopedKey(scope, selectedLeaderId, activeFY);
  const getDefaultRef = useRef(getDefault);
  getDefaultRef.current = getDefault;
  const validateRef = useRef(validate);
  validateRef.current = validate;

  const [state, setStateInternal] = useState(() => getDefault(activeFY));

  useEffect(() => {
    if (!selectedLeaderId || !activeFY) {
      setStateInternal(getDefaultRef.current(activeFY));
      return;
    }
    const stored = readScopedJson(key, null);
    const fallback = getDefaultRef.current(activeFY);
    let next = stored ?? fallback;
    if (validateRef.current) {
      next = validateRef.current(next, { activeFY, fallback }) ?? fallback;
    }
    setStateInternal(next);
  }, [key, selectedLeaderId, activeFY]);

  const setState = useCallback((updater) => {
    setStateInternal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (key) writeScopedJson(key, next);
      return next;
    });
  }, [key]);

  return [state, setState];
}
