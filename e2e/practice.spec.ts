import { expect, test } from '@playwright/test';
import { button, openExample } from './helpers';

test('practice: draw the timing diagram of exam 2026A 2D, check it, see the answer', async ({ page }) => {
  await openExample(page, 'tff');
  await page.getByRole('tab', { name: 'תרגול', exact: true }).click();
  const labels = page.locator('.practice-label');
  await expect(labels).toHaveCount(4);
  await expect(labels.first()).toContainText('נתון'); // the clock is given

  // nothing drawn yet: every signal stays at its value at t = 0, so all three are wrong
  await button(page, 'בדיקה').click();
  await expect(page.locator('.practice-status')).toContainText('0 מתוך 3');

  // draw Q0 right: it toggles at every rising edge (t = 1, 3, 5, …), cells of 0.5
  const svg = page.locator('.practice-svg');
  const box = (await svg.boundingBox())!;
  const cells = 32;
  const cellW = (box.width - 24) / cells;
  const y = box.y + 22 + 1 * 34 + 17; // second row: ff.Q
  for (let start = 2; start < cells; start += 8) {
    // high from t = 1 to t = 3: cells start..start+3
    await page.mouse.move(box.x + 12 + cellW * (start + 0.5), y);
    await page.mouse.down();
    await page.mouse.move(box.x + 12 + cellW * (start + 3.5), y, { steps: 4 });
    await page.mouse.up();
  }
  await button(page, 'בדיקה').click();
  await expect(page.locator('.practice-status')).toContainText('1 מתוך 3');
  await expect(labels.nth(1)).toContainText('✓');

  await button(page, 'הצגת התשובה').click();
  await expect(page.locator('.practice-answer')).toHaveCount(3);

  await button(page, 'הרצה בדיאגרמה').click();
  await expect(page.getByRole('tab', { name: 'דיאגרמת זמנים' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.timing-svg')).toBeVisible();
});

test('practice needs something that changes in time', async ({ page }) => {
  await openExample(page, 'mux2');
  await page.getByRole('tab', { name: 'תרגול', exact: true }).click();
  await expect(page.locator('.analysis-empty')).toContainText('שינויים מתוזמנים');
});
