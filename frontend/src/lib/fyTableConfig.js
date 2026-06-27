export const ENGAGEMENT_COLUMNS = {
  base: ['num', 'name', 'manager', 'relPartner', 'elStatus', 'green', 'amber', 'blueSky', 'total', 'collected', 'balance', 'remarks'],
  monthCols: ['mayCol', 'juneCol', 'julyCol'],
};

export function hasMonthColumns(clients) {
  if (!clients?.length) return false;
  return clients.some(c => (c.mayCol || 0) > 0 || (c.juneCol || 0) > 0 || (c.julyCol || 0) > 0);
}
