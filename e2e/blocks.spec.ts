import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { button, lamp, node, openExample } from './helpers';

/** Draw a wire from an output port to an input port. */
async function wire(page: Page, from: [string, string], to: [string, string]) {
  const a = (await node(page, from[0]).locator(`[data-handleid="${from[1]}"]`).boundingBox())!;
  const b = (await node(page, to[0]).locator(`[data-handleid="${to[1]}"]`).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('save a MUX 2:1 built from gates as a block, use it, and look inside', async ({ page }) => {
  await openExample(page, 'mux2');
  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('Control+KeyA');
  await page.getByLabel('שם הבלוק').fill('MUX2g');
  await button(page, 'שמירה כבלוק').click();
  await expect(page.locator('.palette-mine')).toContainText('MUX2g');

  // a new circuit keeps the block in the palette
  await button(page, 'מעגל חדש').click();
  await page.locator('.palette-mine .palette-item', { hasText: 'MUX2g' }).click();
  for (const t of ['מתג', 'מתג', 'מתג', 'נורה']) await button(page, t).click();
  await page.locator('.react-flow__controls-fitview').click();
  await expect(node(page, 'B1')).toContainText('MUX2g');

  await wire(page, ['sw1', 'out'], ['B1', 'I0']);
  await wire(page, ['sw2', 'out'], ['B1', 'I1']);
  await wire(page, ['sw3', 'out'], ['B1', 'S0']);
  await wire(page, ['B1', 'F'], ['led1', 'in']);
  await expect(lamp(page, 'led1')).toHaveText('0');

  // I0 = 1 and S0 = 0: the gates inside pass I0 on, Tp after Tp
  await node(page, 'sw1').locator('.cm-switch').click();
  await button(page, 'דלג לסוף').click();
  await expect(lamp(page, 'led1')).toHaveText('1');

  await node(page, 'B1').click();
  await expect(page.locator('.expand-field')).toContainText('MUX2g: 4 רכיבים');
  await button(page, 'פירוק לרכיבים').click();
  await expect(node(page, 'B1_n1')).toBeVisible();
  await expect(lamp(page, 'led1')).toHaveText('1');
});
