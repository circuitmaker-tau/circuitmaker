import { expect, test } from '@playwright/test';
import { node, openExample } from './helpers';

test('a component can be renamed, and stays selected', async ({ page }) => {
  await openExample(page, 'mux2');
  await node(page, 'S0').click({ position: { x: 6, y: 6 } });
  const name = page.getByLabel('שם', { exact: true });
  await expect(name).toHaveValue('S0');
  await name.fill('S');
  await name.press('Enter');
  await expect(node(page, 'S')).toBeVisible();
  await expect(node(page, 'S0')).toHaveCount(0);
  await expect(page.getByLabel('שם', { exact: true })).toHaveValue('S');
  // a taken name is refused with a message
  await page.getByLabel('שם', { exact: true }).fill('I0');
  await page.getByLabel('שם', { exact: true }).press('Enter');
  await expect(page.locator('.status')).toContainText('כבר יש במעגל רכיב בשם I0');
  await expect(page.getByLabel('שם', { exact: true })).toHaveValue('S');
});
