/** Phone layout (run on the iPhone 14 project). */
import { expect, test } from '@playwright/test';
import { openExample } from './helpers';

test('no sideways scrolling, and the panels open as sheets', async ({ page }) => {
  await openExample(page, 'mux2');
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  const tabs = page.locator('.mobile-tabs');
  await expect(tabs).toBeVisible();
  await tabs.getByRole('button', { name: 'רכיבים' }).click();
  await expect(page.locator('.palette')).toBeVisible();
  await page.getByRole('button', { name: 'AND', exact: true }).click();
  await expect(page.locator('.palette')).toBeHidden();
  await tabs.getByRole('button', { name: 'זמנים וניתוח' }).click();
  await expect(page.locator('.timing')).toBeVisible();
});
