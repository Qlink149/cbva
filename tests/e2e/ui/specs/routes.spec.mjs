// Every router route as every role: no console errors, no CSP violations, no failed or 3xx/5xx network calls,
// no unexpected 4xx API calls. A screenshot per route and role goes to tests/e2e/artifacts/screens (gitignored).
import { test, expect } from '@playwright/test';
import { installCspCollector, monitor, setLeaderAndFy, settle, shotPath, storagePath } from './helpers.mjs';

const MY_PLAN = ['/', '/my-plan/dashboard', '/my-plan', '/my-plan/collections', '/my-plan/team', '/my-plan/clients',
  '/my-plan/engagements', '/my-plan/pipeline', '/my-plan/clients/e2e-unknown-client', '/my-plan/actions',
  '/my-plan/meetings', '/my-plan/scorecard', '/my-plan/blue-sky-summary'];
const FIRMWIDE = ['/firmwide', '/firmwide/leaders', '/firmwide/team', '/firmwide/clients', '/firmwide/origination',
  '/firmwide/board-pack', '/firmwide/consolidated'];
const ADMIN_ONLY = ['/firmwide/change-log', '/admin'];

// Real leaders' data is only READ here. The leader shown to admin/management is one with existing appraisal
// rounds, so the scorecard page's GET (which creates missing rounds) adds nothing.
const VIEW_LEADER = process.env.E2E_VIEW_LEADER || 'manan';

const PLAN = {
  admin: { leader: VIEW_LEADER, allowed: [...MY_PLAN, ...FIRMWIDE, ...ADMIN_ONLY], denied: [] },
  management: { leader: VIEW_LEADER, allowed: [...MY_PLAN, ...FIRMWIDE], denied: ADMIN_ONLY },
  leader_a: { leader: 'e2e_leader_a', allowed: MY_PLAN, denied: [...FIRMWIDE, ...ADMIN_ONLY] },
};

for (const [role, plan] of Object.entries(PLAN)) {
  test.describe(`routes as ${role}`, () => {
    test.use({ storageState: storagePath(role) });
    test.beforeEach(async ({ context }) => {
      await installCspCollector(context);
      await setLeaderAndFy(context, plan.leader);
    });
    test.afterEach(async ({ context }) => { await context.storageState({ path: storagePath(role) }); });

    for (const route of plan.allowed) {
      test(`${role} ${route}`, async ({ page }) => {
        const m = monitor(page);
        await page.goto(route);
        await settle(page);
        await expect(page).not.toHaveURL(/\/home$/);                   // still logged in
        await expect(page.locator('body')).not.toContainText(/something went wrong|page not found/i);
        await page.screenshot({ path: shotPath(role, route), fullPage: true });
        await m.assertClean(`${role} ${route}`);
      });
    }

    for (const route of plan.denied) {
      test(`${role} ${route} is refused in the UI without API errors`, async ({ page }) => {
        // the route guard must stop the page before it calls admin/management APIs (a 403 here = guard leak)
        const m = monitor(page);
        await page.goto(route);
        await settle(page);
        await page.screenshot({ path: shotPath(role, `denied${route}`), fullPage: true });
        const forbiddenCalls = m.apiCalls.filter((c) => / 403$/.test(c));
        expect(forbiddenCalls, `API calls refused with 403 on ${route}: ${forbiddenCalls}`).toEqual([]);
        await m.assertClean(`${role} denied ${route}`);
      });
    }
  });
}
