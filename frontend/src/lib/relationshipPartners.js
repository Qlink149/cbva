import { firstName } from '@/lib/personNames';

export function relationshipPartnerList(value) {
  if (Array.isArray(value)) {
    return value.map(String).map(v => v.trim()).filter(Boolean);
  }

  if (value == null) return [];

  return String(value)
    .split(/[,;|]+/)
    .map(v => v.trim())
    .filter(Boolean);
}

export function relationshipPartnerLabel(value) {
  const partners = relationshipPartnerList(value);
  return partners.length > 0 ? partners.join(', ') : '-';
}

export function displayPartnerNames(value) {
  const partners = relationshipPartnerList(value);
  if (partners.length === 0) return '-';
  return partners.map(firstName).join(', ');
}

export function hasAnyRelationshipPartner(value, selectedPartners) {
  if (!selectedPartners?.length) return true;
  const partners = relationshipPartnerList(value);
  return partners.some(partner => selectedPartners.includes(partner));
}

export function uniqueRelationshipPartners(rows) {
  const partners = new Set();
  rows.forEach(row => {
    relationshipPartnerList(row.relPartner).forEach(partner => partners.add(partner));
  });
  return Array.from(partners).sort((a, b) => a.localeCompare(b));
}
