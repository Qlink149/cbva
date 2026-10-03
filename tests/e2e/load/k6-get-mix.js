// Load test: 20 concurrent users, realistic GET mix, 5 minutes, against the deployed API.
//   docker run --rm -i -e API=https://cbva-api.claraai.tech -e TOKENS="<admin>,<management>,<leader>" \
//     grafana/k6 run --summary-export=/dev/stdout - < tests/e2e/load/k6-get-mix.js
// Tokens are access tokens of the temporary e2e accounts (provision.py), fetched right before the run (15-min TTL).
// Read-only GETs. Appraisal pages are only requested for leaders that already have rounds, so the run creates no
// data; GET /api/pipeline/ re-materialises the current month's snapshot as it does on every normal page load.
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const API = __ENV.API || 'https://cbva-api.claraai.tech';
const [ADMIN, MGMT, LEADER] = (__ENV.TOKENS || '').split(',');
const FY = __ENV.FY || '2627';
const LEADERS = (__ENV.LEADERS || 'manan,varun,priyesh,ritesh,np,abhitan,amol,vinay,biu,ak').split(',');
const WITH_ROUNDS = (__ENV.WITH_ROUNDS || 'manan,priyesh,np,vinay').split(',');

const NAMES = ['me', 'engagements', 'pipeline', 'collections', 'collection_tx', 'bluesky', 'team', 'hiring', 'headcount',
  'eng_actions', 'meetings', 'fw_aggregate', 'fw_clients', 'fw_summary', 'consolidated', 'leaders', 'fys', 'rounds',
  'scorecard', 'kra_resolved', 'own_engagements', 'own_tasks', 'audit_log'];

export const options = {
  scenarios: { users: { executor: 'constant-vus', vus: 20, duration: __ENV.DURATION || '5m' } },
  // per-endpoint entries are informational (always pass) so the summary prints each endpoint's p95
  thresholds: Object.assign({ http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1500'] },
    ...NAMES.map((n) => ({ [`http_req_duration{name:${n}}`]: ['p(95)<60000'] }))),
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const errors = new Rate('non_2xx');
const redirects = new Rate('redirects');

function get(path, token, name) {
  const res = http.get(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, redirects: 0, tags: { name } });
  errors.add(res.status < 200 || res.status >= 300);
  redirects.add(res.status >= 300 && res.status < 400);
  check(res, { [`${name} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  return res;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default function () {
  const r = Math.random();
  if (r < 0.55) {                         // leader dashboard / engagements as admin or management viewing a leader
    const token = Math.random() < 0.6 ? ADMIN : MGMT;
    const l = pick(LEADERS);
    const q = `leader_id=${l}&fiscal_year=${FY}`;
    group('leader pages', () => {
      get('/api/auth/me', token, 'me');
      get(`/api/engagements?${q}`, token, 'engagements');
      get(`/api/pipeline?${q}`, token, 'pipeline');
      get(`/api/collections?${q}`, token, 'collections');
      get(`/api/collection-transactions?${q}`, token, 'collection_tx');
      get(`/api/bluesky?${q}`, token, 'bluesky');
      get(`/api/team?${q}`, token, 'team');
      get(`/api/hiring?${q}`, token, 'hiring');
      get(`/api/headcount?${q}`, token, 'headcount');
      get(`/api/engagement-actions?${q}`, token, 'eng_actions');
      get(`/api/client-meetings?${q}`, token, 'meetings');
    });
  } else if (r < 0.75) {                  // firmwide pages
    const token = Math.random() < 0.5 ? ADMIN : MGMT;
    group('firmwide', () => {
      get(`/api/firmwide/dashboard-aggregate?fiscal_year=${FY}`, token, 'fw_aggregate');
      get(`/api/firmwide/clients?fiscal_year=${FY}`, token, 'fw_clients');
      get(`/api/firmwide/summary?fiscal_year=${FY}`, token, 'fw_summary');
      get(`/api/consolidated-summary?fiscal_year=${FY}`, token, 'consolidated');
      get('/api/leaders', token, 'leaders');
      get('/api/financial-years', token, 'fys');
    });
  } else if (r < 0.85) {                  // scorecard (only leaders that already have rounds)
    const q = `leader_id=${pick(WITH_ROUNDS)}&fiscal_year=${FY}`;
    group('scorecard', () => {
      get(`/api/appraisals/rounds?${q}`, ADMIN, 'rounds');
      get(`/api/appraisals/scorecard?${q}&period=yearend`, ADMIN, 'scorecard');
      get(`/api/kra/resolved?fiscal_year=${FY}`, ADMIN, 'kra_resolved');
    });
  } else {                                // a leader's own pages (e2e leader account) + admin audit log
    const q = `leader_id=e2e_leader_a&fiscal_year=${FY}`;
    group('own + admin', () => {
      get(`/api/engagements?${q}`, LEADER, 'own_engagements');
      get(`/api/tasks?leader_id=e2e_leader_a`, LEADER, 'own_tasks');
      get('/api/audit-log?skip=0&limit=50', ADMIN, 'audit_log');
    });
  }
  sleep(1 + Math.random() * 2);           // think time 1-3 s
}
