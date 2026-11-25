import { expect, test } from '@playwright/test';
import { button, node } from './helpers';

test('the worlds menu leads to Boolean expressions, which finds a counterexample', async ({
  page,
}) => {
  await page.goto('./#/editor');
  const worlds = page.getByRole('navigation', { name: 'עולמות' });
  await expect(worlds.getByRole('link', { name: 'מעגלים' })).toHaveAttribute('aria-current', 'page');
  await worlds.getByRole('link', { name: 'ביטויים בוליאניים' }).click();
  await expect(page).toHaveURL(/#\/expressions/);

  // the distributive law: the same function
  await expect(page.locator('.expr-verdict')).toContainText('שקולים: זו אותה פונקציה');
  await expect(page.locator('.expr-table tbody tr')).toHaveCount(8);

  // the common mistake: (A + B)' is not A' + B'
  await button(page, 'טעות נפוצה').click();
  await expect(page.locator('.expr-verdict')).toContainText('לא שקולים');
  await expect(page.locator('.expr-verdict')).toContainText('A = 0, B = 1');
  await expect(page.locator('.expr-table tr.is-diff')).toHaveCount(2);

  // a typo is shown under its own field
  const first = page.getByLabel('ביטוי ראשון');
  await first.fill('A + (B');
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#expr-error-a')).toContainText(')');
  await expect(page.locator('.expr-verdict')).toHaveCount(0);

  // De Morgan, then one side opened as a circuit in the editor
  await button(page, 'דה מורגן').click();
  await expect(page.locator('.expr-verdict')).toContainText('שקולים');
  await button(page, 'פתיחה כמעגל').first().click();
  await expect(page).toHaveURL(/#\/editor/);
  for (const id of ['A', 'B']) await expect(node(page, id)).toBeVisible();
});
