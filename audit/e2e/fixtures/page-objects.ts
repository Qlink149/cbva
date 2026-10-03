import { type Page, expect } from '@playwright/test';



export async function selectLeader(page: Page, leaderId: string): Promise<void> {

  const leader = page.getByLabel('Leader');

  await expect(leader).toBeEnabled({ timeout: 30000 });

  await leader.selectOption(leaderId);

}



export async function selectFY(page: Page, slug: string): Promise<void> {

  const fy = page.getByLabel('Fiscal year');

  await expect(fy).toBeEnabled({ timeout: 30000 });

  await fy.selectOption(slug);

}



export async function openClientCombobox(page: Page): Promise<void> {

  await page.getByRole('button', { name: /select client/i }).click();

  await expect(page.getByPlaceholder('Search clients…')).toBeVisible();

}



export async function pickFirstClientFromCombobox(page: Page): Promise<string> {

  await openClientCombobox(page);

  const search = page.getByPlaceholder('Search clients…');

  await search.fill('a');

  const popover = page.locator('[data-radix-popper-content-wrapper]').last();

  const option = popover.locator('button').filter({ hasText: /.+/ }).first();

  await expect(option).toBeVisible({ timeout: 10000 });

  const name = (await option.textContent())?.trim() || '';

  await option.click();

  return name;

}



export function additionalWorkCard(page: Page) {

  return page.locator('div').filter({ hasText: /^Additional Work/ }).filter({ has: page.locator('form') }).first();

}



export async function fillAdditionalWork(

  page: Page,

  opts: { client: string; amount: string },

): Promise<void> {

  const card = page.locator('text=Separate from Blue Sky Additional').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")]');

  await card.scrollIntoViewIfNeeded();

  await card.getByPlaceholder('Client').fill(opts.client);

  await card.getByPlaceholder('Amount').fill(opts.amount);

  await card.getByRole('button', { name: 'Add' }).click();

}


