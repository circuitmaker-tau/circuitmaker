import { expect, test } from '@playwright/test';
import { openExample } from './helpers';

test('critical path: the MUX from gates is 3 Tp through the inverter, highlighted on the canvas', async ({ page }) => {
  await openExample(page, 'mux2');
  await page.getByRole('tab', { name: 'נתיב קריטי' }).click();
  await expect(page.locator('.critical-total')).toContainText('3 ns');
  await expect(page.locator('.critical-summary')).toContainText('S0 → n1 → a2 → o1 → F');
  // the path is marked on the canvas: four components and their wires
  await expect(page.locator('.cm-node.on-path-2')).toHaveCount(4);
  await expect(page.locator('.cm-path.on-path-2')).toHaveCount(4);
});

test('critical path: the ripple-carry adder, and another lamp chosen from the table', async ({ page }) => {
  await openExample(page, 'ripple');
  await page.getByRole('tab', { name: 'נתיב קריטי' }).click();
  await expect(page.locator('.critical-total')).toContainText('4 ns');
  // rows are sorted by delay: Cout, S3, S2, S1, S0
  const s1 = page.locator('.critical-table tbody tr').nth(3);
  await expect(s1.locator('td').first()).toHaveText('S1');
  await s1.click();
  // S1 waits for FA0 and FA1 only
  await expect(page.locator('.cm-node.on-path-2')).toHaveCount(3);
});
