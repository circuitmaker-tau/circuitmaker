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

test('a Karnaugh map: a misplaced cell, a group that is not a rectangle, then the minimal cover', async ({
  page,
}) => {
  await page.goto('./#/karnaugh');
  const cell = (m: number) => page.getByRole('button', { name: new RegExp(`^תא ${m}:`) });
  await page.getByLabel(/פונקציה משלך/).fill('F(A,B,C,D) = Σ(0,2,5,7,8,10,13,15)');
  await button(page, 'טעינה').click();
  await expect(page.locator('.kmap-question')).toHaveText('F(A,B,C,D) = Σm(0, 2, 5, 7, 8, 10, 13, 15)');

  // 3 instead of 2: the column order is 00, 01, 11, 10
  for (const m of [0, 3]) await cell(m).click();
  await button(page, 'בדיקה').click();
  await expect(page.locator('.expr-verdict')).toContainText('תא אחד לא נכון');
  await expect(cell(3)).toHaveClass(/is-wrong/);

  await button(page, 'הצגת התשובה').click();
  await expect(page.locator('.expr-verdict')).toContainText('המפה נכונה');
  await button(page, 'לשלב הקבוצות').click();

  // three cells are not a group
  for (const m of [0, 2, 8]) await cell(m).click();
  await button(page, 'הוספת קבוצה').click();
  await expect(page.getByRole('alert')).toContainText('מלבן של 1, 2, 4 או 8');

  // the four corners, then check: the middle is not covered yet
  await cell(10).click();
  await button(page, 'הוספת קבוצה').click();
  await button(page, 'בדיקה').click();
  await expect(page.locator('.expr-verdict')).toContainText('5, 7, 13, 15');

  for (const m of [5, 7, 13, 15]) await cell(m).click();
  await button(page, 'הוספת קבוצה').click();
  await expect(page.locator('.kmap-expression')).toHaveText("F = B'·D' + B·D");
  await expect(page.locator('.expr-verdict')).toContainText('כיסוי מינימלי');
});

test('a state machine: the bamba table cell by cell, then its diagram arrow by arrow', async ({ page }) => {
  await page.goto('./#/fsm');
  // WK9B slide 14: from 00 on x = 1 the machine goes to 01; from 01 on x = 1 to 10
  await page.getByLabel('המצב הבא ממצב 00 כש-X=1').fill('01');
  await page.getByLabel('המצב הבא ממצב 01 כש-X=1').fill('11');
  await button(page, 'בדיקה').click();
  await expect(page.locator('.expr-verdict')).toContainText('תא אחד לא נכון');
  await expect(page.getByLabel(/המצב הבא ממצב 01 כש-X=1, שגוי/)).toBeVisible();

  await button(page, 'הצגת התשובה').click();
  await expect(page.locator('.expr-verdict')).toContainText('Mealy');
  await button(page, 'לדיאגרמת המצבים').click();

  const state = (c: string) => page.getByRole('button', { name: new RegExp(`^מצב ${c}`) });
  // a loop on 00 for x = 0, and an arrow 10 -> 00 on x = 1, which is wrong
  await state('00').click();
  await state('00').click();
  await button(page, 'הוספת החץ').click();
  await state('10').click();
  await state('00').click();
  await page.getByLabel(/קלט/).selectOption('1');
  await button(page, 'הוספת החץ').click();
  await button(page, 'בדיקה').click();
  await expect(page.locator('.expr-verdict')).toContainText('הולך למצב הלא נכון');
  await expect(page.locator('.expr-verdict')).toContainText('חסרים 6 חצים');

  await button(page, 'הצגת הדיאגרמה').click();
  await expect(page.locator('.expr-verdict')).toContainText('הדיאגרמה נכונה');
  await expect(page.locator('.fsm-arrows li')).toHaveCount(8);
});
