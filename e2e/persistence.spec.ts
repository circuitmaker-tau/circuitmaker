import { expect, test } from '@playwright/test';
import { openExample } from './helpers';

test('the circuit is saved in the browser and comes back after a reload', async ({ page }) => {
  await openExample(page, 'ripple');
  const name = page.getByLabel('שם המעגל');
  await name.fill('המסכם שלי');
  await expect(page.locator('.save-status')).toHaveText('נשמר בדפדפן');
  await page.reload();
  await expect(name).toHaveValue('המסכם שלי');
  await expect(page.locator('.react-flow__node')).toHaveCount(18);
});

test('export gives a JSON file that import reads back', async ({ page }) => {
  await openExample(page, 'counter');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ייצוא JSON' }).click();
  const file = await (await download).path();
  await page.getByRole('button', { name: 'מעגל חדש' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles(file!);
  await expect(page.locator('.react-flow__node')).toHaveCount(7);
});

test('the speed and the bottom panel are remembered too', async ({ page }) => {
  await openExample(page, 'bamba');
  await page.locator('.sim-controls select').selectOption('4');
  await page.getByRole('tab', { name: 'ניתוח hazards' }).click();
  await page.reload();
  await expect(page.locator('.sim-controls select')).toHaveValue('4');
  await expect(page.locator('.analysis, .analysis-empty').first()).toBeVisible();
});
