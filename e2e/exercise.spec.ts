import { expect, test } from '@playwright/test';

test('self-practice: a question is loaded, the empty circuit fails, the solution scores 100', async ({ page }) => {
  await page.goto('./#/editor');
  await page.getByRole('tab', { name: 'תרגול עצמי' }).click();
  await page.getByRole('button', { name: 'בינוני' }).click();
  await page.getByRole('button', { name: 'שאלה חדשה' }).click();
  // switches and a lamp, and the task in the "what you learn here" box
  await expect(page.locator('.exercise-question h3')).toBeVisible();
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await page.getByRole('button', { name: 'הגשה' }).click();
  await expect(page.locator('.exercise-score b')).toHaveText('0/100');
  await expect(page.locator('.exercise-notes')).toContainText('לא מחובר');

  await page.getByRole('button', { name: 'רמז' }).click();
  await expect(page.locator('.exercise-hint')).toBeVisible();
  await page.getByRole('button', { name: 'הצגת פתרון' }).click();
  await page.getByRole('button', { name: 'הגשה' }).click();
  await expect(page.locator('.exercise-score b')).toHaveText('100/100');
  await expect(page.locator('.exercise-notes')).toContainText('כל המגבלות של השאלה נשמרו');

  // the question is still there after a reload
  const title = await page.locator('.exercise-question h3').innerText();
  await page.reload();
  // the panel comes back open on the same tab
  await expect(page.locator('.exercise-question h3')).toHaveText(title);
});
