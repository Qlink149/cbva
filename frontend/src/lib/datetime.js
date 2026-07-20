import { formatDistanceToNow, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const TZ = 'Asia/Kolkata';
const TZ_SUFFIX_RE = /[Zz]$|[+-]\d{2}:\d{2}$/;

/** Parse API datetime; treat missing offset as UTC. */
export function parseApiDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = typeof value === 'string' && !TZ_SUFFIX_RE.test(value.trim())
    ? `${value.trim()}Z`
    : String(value);
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a datetime in IST. */
export function formatIstDate(value, pattern = 'dd MMM yyyy') {
  const d = parseApiDate(value);
  return d ? formatInTimeZone(d, TZ, pattern) : '—';
}

/** Relative time (e.g. "5 minutes ago") with correct UTC parse. */
export function formatIstRelative(value, options = { addSuffix: true }) {
  const d = parseApiDate(value);
  return d ? formatDistanceToNow(d, options) : '—';
}
