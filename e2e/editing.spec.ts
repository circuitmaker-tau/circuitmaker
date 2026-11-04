import { expect, test } from '@playwright/test';
import { lamp, node, openExample } from './helpers';

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

test("CLR' and PRE' can be turned on for a flip-flop, and CLR' clears it at once", async ({ page }) => {
  await openExample(page, 'mod6');
  // the modulo 6 counter already uses CLR': after 5 cycles it shows 5 (0101), after the 6th 0
  const cycle = page.getByRole('button', { name: 'מחזור' });
  for (let i = 0; i < 5; i++) await cycle.click();
  const word = async () =>
    (await Promise.all(['Q3', 'Q2', 'Q1', 'Q0'].map((id) => lamp(page, id).innerText()))).join('');
  await expect.poll(word).toBe('0101');
  await cycle.click();
  await expect.poll(word).toBe('0000');
  // on another flip-flop the inputs appear when the box is ticked
  await openExample(page, 'ffchain');
  await node(page, 'f1').click({ position: { x: 6, y: 6 } });
  await expect(node(page, 'f1').locator('[data-handleid="CLR\'"]')).toHaveCount(0);
  await page.getByLabel(/כניסות אסינכרוניות/).check();
  await expect(node(page, 'f1').locator('[data-handleid="CLR\'"]')).toHaveCount(1);
  await expect(node(page, 'f1').locator('[data-handleid="PRE\'"]')).toHaveCount(1);
});
