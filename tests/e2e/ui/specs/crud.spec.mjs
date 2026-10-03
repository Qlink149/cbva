// One create + edit + delete per module through the real UI, as the temporary leader e2e_leader_a (FY 2627).
// Where the product has no delete (collections plan, headcount, blue sky) the closest UI "remove" is used and
// noted. Each step waits for the real API call and checks its status; the page monitor must stay clean.
import { test, expect } from '@playwright/test';
import { API, FY, LEADER_A, api, installCspCollector, monitor, settle, storagePath } from './helpers.mjs';

test.use({ storageState: storagePath('leader_a') });
test.describe.configure({ mode: 'default' });

const RUN = process.env.E2E_RUN;          // set once per run in playwright.config.mjs (survives worker restarts)
const ENG = `E2E UI Engagement ${RUN}`;
const MONTH = String(new Date().getMonth() + 1).padStart(2, '0');
const MON = new Date().toLocaleString('en-US', { month: 'short' });

const call = (page, method, rx, okStatus = [200, 201, 204]) => page.waitForResponse((r) =>
  r.request().method() === method && r.url().startsWith(API) && rx.test(r.url().slice(API.length))
).then((r) => { expect(okStatus, `${method} ${r.url()} -> ${r.status()}`).toContain(r.status()); return r; });

let m;
test.beforeEach(async ({ context, page }) => { await installCspCollector(context); m = monitor(page); });
test.afterEach(async ({ context }) => {
  await context.storageState({ path: storagePath('leader_a') });   // keep rotated tokens for the next test
  await m.assertClean('crud');
});

async function engagementRow(page, name) {
  return page.getByRole('row').filter({ hasText: name }).first();
}

test('engagements: create, edit name, (delete runs last from the pipeline page)', async ({ page, request }) => {
  await page.goto('/my-plan/engagements');
  await settle(page);
  await page.getByRole('button', { name: 'Add Engagement' }).click();
  await page.getByPlaceholder('e.g. Tata Consultancy Services').fill(ENG);
  const created = call(page, 'POST', /^\/api\/engagements\/?$/);
  await page.getByRole('button', { name: 'Save Engagement' }).click();
  await created;
  const row = await engagementRow(page, ENG);
  await expect(row).toBeVisible();
  await row.getByTitle('Click to edit name').click();
  const edited = call(page, 'PUT', /^\/api\/engagements\/[0-9a-f]{24}$/);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(`${ENG} edited`);
  await page.keyboard.press('Enter');
  await edited;
  const list = await (await api(request, 'leader_a', 'GET', `/api/engagements/?leader_id=${LEADER_A}&fiscal_year=${FY}`)).json();
  expect((list.data || list).some((e) => e.name === `${ENG} edited`)).toBeTruthy();
});

test('collections: set, change and clear the collected amount for this month', async ({ page, request }) => {
  await page.goto('/my-plan/engagements');
  await settle(page);
  const row = await engagementRow(page, `${ENG} edited`);
  const cell = row.locator('td[title="Click to set collected amount for this month"]').first();
  for (const [value, expectPost] of [['5000', true], ['6000', true], ['0', false]]) {
    await cell.click();
    const resp = expectPost ? call(page, 'POST', /^\/api\/collection-transactions\/?$/) : call(page, 'DELETE', /^\/api\/collection-transactions\/[0-9a-f]{24}$/);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(value);
    await page.keyboard.press('Enter');
    await resp;
    await settle(page);
  }
  const tx = await (await api(request, 'leader_a', 'GET', `/api/collection-transactions/?leader_id=${LEADER_A}&fiscal_year=${FY}`)).json();
  expect((tx.data || tx).filter((t) => (t.client_name || '').includes(RUN))).toHaveLength(0);   // cleared
  await page.goto('/my-plan/collections');
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
});

test('actions: create, change status, delete', async ({ page }) => {
  await page.goto('/my-plan/actions');
  await settle(page);
  await page.getByRole('button', { name: 'New Action Point' }).click();
  await page.getByRole('button', { name: /select client/i }).click();
  await page.getByPlaceholder('Search clients…').fill(RUN);
  await page.locator('[data-radix-popper-content-wrapper] button').filter({ hasText: RUN }).first().click();
  await page.getByPlaceholder('Action *').fill(`E2E UI action ${RUN}`);
  const created = call(page, 'POST', /^\/api\/engagement-actions\/?$/);
  await page.getByRole('button', { name: 'Add Action Point' }).click();
  await created;
  const row = page.getByRole('row').filter({ hasText: `E2E UI action ${RUN}` }).first();
  await expect(row).toBeVisible();
  const status = call(page, 'PATCH', /^\/api\/engagement-actions\/[0-9a-f]{24}\/status$/);
  await row.locator('select').first().selectOption('Completed');
  await status;
  const del = call(page, 'DELETE', /^\/api\/engagement-actions\/[0-9a-f]{24}$/);
  await row.getByRole('button').last().click();
  await del;
  await expect(page.getByRole('row').filter({ hasText: `E2E UI action ${RUN}` })).toHaveCount(0);
});

test('meetings: add client, change frequency, delete', async ({ page }) => {
  await page.goto('/my-plan/meetings');
  await settle(page);
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByPlaceholder('Client name *').fill(`E2E UI Client ${RUN}`);
  const created = call(page, 'POST', /^\/api\/client-meetings\/?$/);
  await page.getByPlaceholder('Client name *').press('Enter');
  await created;
  const row = page.getByRole('row').filter({ hasText: `E2E UI Client ${RUN}` }).first();
  await expect(row).toBeVisible();
  const put = call(page, 'PUT', /^\/api\/client-meetings\/[0-9a-f]{24}$/);
  await row.locator('select').first().selectOption('Monthly');
  await put;
  const del = call(page, 'DELETE', /^\/api\/client-meetings\/[0-9a-f]{24}$/);
  await row.getByRole('button').last().click();
  await del;
  await expect(page.getByRole('row').filter({ hasText: `E2E UI Client ${RUN}` })).toHaveCount(0);
});

test('team: add member, edit, delete (confirm dialog)', async ({ page }) => {
  // Deployed API: blank date -> 422, real date -> 500 (bson datetime.date). Fixed in PR #5; remove when deployed.
  test.fail(process.env.E2E_PR5_DEPLOYED !== '1', 'team/hiring create fails until PR #5 is deployed');
  await page.goto('/my-plan/team');
  await settle(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('e.g. Rahul Sharma').fill(`E2E UI Member ${RUN}`);
  const created = call(page, 'POST', /^\/api\/team\/?$/);
  await page.getByRole('dialog').getByRole('button', { name: 'Add Team Member' }).last().click();
  await created;
  await page.keyboard.press('Escape');
  const card = page.locator('div.group').filter({ hasText: `E2E UI Member ${RUN}` }).first();
  await expect(card).toBeVisible();
  await card.hover();
  await card.getByTitle('Edit member').click();
  await page.getByRole('dialog').getByPlaceholder('e.g. Rahul Sharma').fill(`E2E UI Member ${RUN} edited`);
  const put = call(page, 'PUT', /^\/api\/team\/[0-9a-f]{24}$/);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await put;
  await page.keyboard.press('Escape');
  const edited = page.locator('div.group').filter({ hasText: `E2E UI Member ${RUN} edited` }).first();
  await edited.hover();
  page.once('dialog', (d) => d.accept());
  const del = call(page, 'DELETE', /^\/api\/team\/[0-9a-f]{24}$/);
  await edited.getByTitle('Delete member').click();
  await del;
});

test('hiring: add requirement, edit remarks, delete', async ({ page }) => {
  // Deployed API: blank date -> 422, real date -> 500 (bson datetime.date). Fixed in PR #5; remove when deployed.
  test.fail(process.env.E2E_PR5_DEPLOYED !== '1', 'team/hiring create fails until PR #5 is deployed');
  await page.goto('/my-plan/team');
  await settle(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Hiring Requirement' }).click();
  await page.getByPlaceholder('e.g. Tax Manager').fill(`E2E UI Role ${RUN}`);
  const created = call(page, 'POST', /^\/api\/hiring\/?$/);
  await page.getByRole('button', { name: 'Add Hiring Requirement' }).click();
  await created;
  await page.keyboard.press('Escape');
  const row = page.locator('div.group, tr').filter({ hasText: `E2E UI Role ${RUN}` }).first();
  await expect(row).toBeVisible();
  const remarks = row.getByPlaceholder('Recruitment stage, interview status, CV availability...');
  const put = call(page, 'PUT', /^\/api\/hiring\/[0-9a-f]{24}$/);
  await remarks.fill('E2E UI remark');
  await remarks.press('Enter');
  await put;
  await row.hover();
  const del = call(page, 'DELETE', /^\/api\/hiring\/[0-9a-f]{24}$/);
  await row.getByTitle('Delete requirement').click();
  await del;
});

test('headcount: set board-approved, change it, clear to 0 (no delete exists)', async ({ page }) => {
  await page.goto('/my-plan/team');
  await settle(page);
  const input = page.getByRole('row', { name: /Associate/ }).getByRole('spinbutton').first();
  for (const v of ['3', '4', '0']) {
    const post = call(page, 'POST', /^\/api\/headcount\/?$/);
    await input.fill(v);
    await input.blur();                       // the cell saves on blur
    await post;
    await settle(page);
  }
});

test('blue sky: add, edit and clear this month\'s remark (no delete exists)', async ({ page }) => {
  await page.goto('/my-plan/blue-sky-summary');
  await settle(page);
  const row = page.getByRole('row').filter({ hasText: 'Current' }).first();
  const remark = row.getByPlaceholder('Add remark...');
  // first save of the month creates the entry (POST); if an earlier run already created it, it is a PUT
  const first = page.waitForResponse((r) => r.url().startsWith(API) && ['POST', 'PUT'].includes(r.request().method())
    && /^\/api\/bluesky\//.test(r.url().slice(API.length))).then((r) => expect([200, 201]).toContain(r.status()));
  await remark.fill(`E2E UI remark ${RUN}`);
  await remark.press('Enter');
  await first;
  await settle(page);
  for (const v of [`E2E UI remark ${RUN} edited`, '']) {
    const put = call(page, 'PUT', /^\/api\/bluesky\/[0-9a-f]{24}$/);
    const box = page.getByRole('row').filter({ hasText: 'Current' }).first().locator('input').last();
    await box.fill(v);
    await box.press('Enter');
    await put.catch((e) => { throw new Error(`${e.message}
API calls: ${m.apiCalls.join(' | ')}`); });
    await settle(page);
  }
});

test('engagements: delete from the pipeline page', async ({ page, request }) => {
  await page.goto('/my-plan/pipeline');
  await settle(page);
  const row = page.getByRole('row').filter({ hasText: `${ENG} edited` }).first();
  await expect(row).toBeVisible();
  const del = call(page, 'DELETE', /^\/api\/engagements\/[0-9a-f]{24}$/);
  await row.getByRole('button').last().click();
  await del;
  const list = await (await api(request, 'leader_a', 'GET', `/api/engagements/?leader_id=${LEADER_A}&fiscal_year=${FY}`)).json();
  expect((list.data || list).some((e) => e.name === `${ENG} edited`)).toBeFalsy();
});
