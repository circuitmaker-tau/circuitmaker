/** The exam demo of the work plan: the MUX glitch, measured, explained and fixed. */
import { expect, test } from '@playwright/test';
import { button, lamp, node, openExample } from './helpers';

test('flipping S0 makes F glitch for one Tp, and the diagram measures it', async ({ page }) => {
  await openExample(page, 'mux2');
  await expect(lamp(page, 'F')).toHaveText('1');
  await node(page, 'S0').locator('.cm-switch').click();
  await button(page, 'עצירה').click();
  // step through the changes until nothing is left: F falls to 0 and comes back
  const step = button(page, 'צעד');
  const seen: string[] = [];
  for (let i = 0; i < 8 && (await step.isEnabled()); i++) {
    await step.click();
    seen.push(await lamp(page, 'F').innerText());
  }
  expect(seen).toContain('0');
  await expect(lamp(page, 'F')).toHaveText('1');
  await expect(page.locator('.timing-glitches')).toHaveText('ריצוד אחד');
  await expect(page.locator('.wave-glitch text')).toHaveText('1 ns');
});

test('the analysis finds the hazard, and the consensus term removes it', async ({ page }) => {
  await openExample(page, 'mux2');
  await page.getByRole('tab', { name: 'ניתוח hazards' }).click();
  const findings = page.locator('.finding');
  await expect(findings.first()).toContainText('static-1 hazard');
  await expect(findings.first()).toContainText('I1·I0');
  await expect(page.locator('.kmap')).toBeVisible();
  await findings
    .first()
    .getByRole('button', { name: /הוספת המונח/ })
    .click();
  await expect(page.locator('.analysis-findings')).toContainText('אין hazard סטטי');
  await expect(page.locator('.finding')).toHaveCount(0);
});

test('the static-0 example of homework 5 plays by itself', async ({ page }) => {
  await openExample(page, 'static0');
  await button(page, 'דלג לסוף').click();
  await expect(page.locator('.sim-time')).toContainText('60.0');
  await expect(page.locator('.wave-glitch text')).toHaveText('10 ns');
});
