import { expect, test } from '@playwright/test';
import { button, lamp, node, openExample } from './helpers';

test('the truth table lists every row, and a click on a row sets the switches', async ({ page }) => {
  await openExample(page, 'mux2');
  await page.getByRole('tab', { name: 'טבלת אמת' }).click();
  await expect(page.locator('.truth-table tbody tr')).toHaveCount(8);
  await expect(page.locator('.truth-forms')).toContainText('Σm(1, 3, 6, 7)');
  await expect(page.locator('.truth-forms')).toContainText('(S0 + I0)(S0\' + I1)');
  // row 6 is S0 = 1, I1 = 1, I0 = 0: F = I1 = 1
  await page.locator('.truth-table tbody tr').nth(6).click();
  await expect(page.locator('.truth-table tr.is-current .truth-m')).toHaveText('6');
  await button(page, 'דלג לסוף').click();
  await expect(lamp(page, 'F')).toHaveText('1');
});

test('a circuit is built from an expression, and undo brings the old one back', async ({ page }) => {
  await openExample(page, 'mux2');
  await button(page, 'מעגל מביטוי').click();
  const input = page.getByLabel('הפונקציה');
  await input.fill('F = AB + (C');
  await expect(page.locator('.from-error')).toContainText(')');
  await expect(button(page, 'בניית המעגל')).toBeDisabled();

  await input.fill('F(A,B,C,D) = Σ(2,3,4,5,10,11,15) + d(14)');
  // a list of minterms has no "as written" form
  await expect(page.getByLabel('כמו שכתבתי')).toBeDisabled();
  await expect(page.locator('.from-preview')).toContainText("F = A'BC' + AC + B'C");
  await button(page, 'בניית המעגל').click();

  await expect(page.locator('.from-expression')).not.toBeVisible();
  for (const id of ['A', 'B', 'C', 'D', 'F']) await expect(node(page, id)).toBeVisible();
  await expect(page.getByLabel('שם המעגל')).toHaveValue("F = A'BC' + AC + B'C");

  // the circuit runs: A=0 B=1 C=0 is m4 (and m5), so F = 1
  await node(page, 'B').locator('.cm-switch').click();
  await button(page, 'דלג לסוף').click();
  await expect(lamp(page, 'F')).toHaveText('1');

  // flipping a switch is not an edit, so one undo is the build
  await page.keyboard.press('Control+KeyZ');
  await expect(node(page, 'S0')).toBeVisible();
});
