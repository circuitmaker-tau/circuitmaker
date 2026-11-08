import { expect, test } from '@playwright/test';
import { button, lamp, node, openExample } from './helpers';

test('take a full adder apart into half adders, and one of those into gates; the sum stays right', async ({ page }) => {
  await openExample(page, 'ripple');
  await expect(lamp(page, 'S3')).toHaveText('1'); // 0011 + 1011 = 1110

  await node(page, 'FA2').click();
  await expect(page.locator('.expand-field')).toContainText('שני חצאי מסכם ו-OR');
  await button(page, 'פירוק לרכיבים').click();
  for (const id of ['FA2_h1', 'FA2_h2', 'FA2_o']) await expect(node(page, id)).toBeVisible();
  await expect(node(page, 'FA2')).toHaveCount(0);

  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
  await node(page, 'FA2_h1').click();
  await button(page, 'פירוק לרכיבים').click();
  await expect(node(page, 'FA2_h1_x')).toBeVisible();
  await expect(node(page, 'FA2_h1_a')).toBeVisible();

  // the adder still adds (a change of structure starts again from the steady state)
  await expect(lamp(page, 'S2')).toHaveText('1');
  await expect(lamp(page, 'S3')).toHaveText('1');
  await expect(lamp(page, 'Cout')).toHaveText('0');

  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  await expect(node(page, 'FA2')).toBeVisible();
});
