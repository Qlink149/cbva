import { formatINRFull } from '@/lib/formatCurrency';

const MONTH_SHORT = {
  '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul',
  '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov',
  '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar',
};

const MONTH_ORDER = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];

function isMonthPlanMap(val) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const keys = Object.keys(val);
  return keys.length > 0 && keys.every((k) => /^\d{2}$/.test(k));
}

/** Pretty-print a monthly_plan map, e.g. "Jul ₹5,00,000 · Aug ₹2,00,000". */
export function formatMonthlyPlanValue(val) {
  if (!isMonthPlanMap(val)) return null;
  const parts = MONTH_ORDER
    .filter((k) => val[k] != null && Number(val[k]) !== 0)
    .map((k) => `${MONTH_SHORT[k] || k} ${formatINRFull(Number(val[k]))}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** Format any audit/history old/new value for display. */
export function formatAuditValue(val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') {
    if (val === 0) return '₹0';
    return formatINRFull(val);
  }
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const plan = formatMonthlyPlanValue(val);
    if (plan != null) return plan;
    try {
      return JSON.stringify(val);
    } catch {
      return '—';
    }
  }
  return String(val);
}
