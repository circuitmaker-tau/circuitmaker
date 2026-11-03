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

test('the timing diagram is drawn again after a visit to the analysis tab', async ({ page }) => {
  await openExample(page, 'mux2');
  await page.getByRole('tab', { name: 'ניתוח hazards' }).click();
  await page.getByRole('tab', { name: 'דיאגרמת זמנים' }).click();
  await node(page, 'S0').locator('.cm-switch').click();
  await page.getByRole('button', { name: 'דלג לסוף' }).click();
  // the diagram spans the panel, not the width of a panel that was removed
  const width = await page.locator('.timing-svg').evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(400);
  await expect(page.locator('.timing-svg')).toContainText('1 ns');
});
