import { useState, useEffect } from 'react';

/**
 * Returns the current Date object, updated every minute.
 * Use this everywhere you need "today's date" so the app always reflects real time.
 */
export function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}