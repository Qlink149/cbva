import { API_URL } from './test-base.js';

export interface Engagement {
  id: string;
  green?: number;
  name?: string;
  [key: string]: unknown;
}

export async function apiListEngagements(
  token: string,
  leaderId: string,
  fy: string,
): Promise<Engagement[]> {
  const res = await fetch(
    `${API_URL}/api/engagements/?leader_id=${leaderId}&fiscal_year=${fy}&limit=500`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`list engagements: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.data || data.items || [];
}

export async function apiFindEngagement(
  token: string,
  leaderId: string,
  fy: string,
  id: string,
): Promise<Engagement | undefined> {
  const list = await apiListEngagements(token, leaderId, fy);
  return list.find((e) => e.id === id);
}

export async function apiCreateEngagement(
  token: string,
  body: Record<string, unknown>,
): Promise<Engagement> {
  const res = await fetch(`${API_URL}/api/engagements/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`create engagement: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function apiUpdateEngagement(
  token: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Engagement> {
  const res = await fetch(`${API_URL}/api/engagements/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`update engagement: ${res.status}`);
  return res.json();
}

export async function apiCreateAction(
  token: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${API_URL}/api/engagement-actions/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = res.status !== 204 ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}
