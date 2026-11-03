import type { Page } from '@playwright/test';

export async function openExample(page: Page, id: string) {
  await page.goto('./#/editor');
  await page.locator('select.examples').selectOption(id);
  // the circuit is fitted to the view once loaded
  await page.waitForTimeout(400);
}

export const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
export const lamp = (page: Page, id: string) => node(page, id).locator('.cm-lamp');
export const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' });
