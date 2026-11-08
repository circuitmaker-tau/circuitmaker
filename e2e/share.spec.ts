import { expect, test } from '@playwright/test';
import { button, lamp, node, openExample } from './helpers';

test('share a circuit with a task as a link, and open it in another browser', async ({ page, browser }) => {
  await openExample(page, 'mux2');
  await page.getByLabel('שם המעגל').fill('המשימה של דנה');
  await button(page, 'שיתוף').click();
  await page.getByLabel('הסבר או משימה למי שפותח (לא חובה)').fill('שנו את S0 ומדדו את משך הריצוד');
  const field = page.getByLabel('הקישור', { exact: true });
  await expect(field).toHaveValue(/#\/editor\?c=[A-Za-z0-9_-]+$/);
  const link = await field.inputValue();
  await button(page, 'סגירה').click();

  // someone else, with nothing saved in their browser
  const other = await browser.newContext({ storageState: 'e2e/fixtures/tour-seen.json' });
  const them = await other.newPage();
  await them.goto(link);
  await expect(node(them, 'S0')).toBeVisible();
  await expect(lamp(them, 'F')).toHaveText('1');
  await expect(them.getByLabel('שם המעגל')).toHaveValue('המשימה של דנה');
  await expect(them.locator('.properties')).toContainText('שנו את S0 ומדדו את משך הריצוד');
  // the address is tidied, so a reload keeps their own changes
  await expect.poll(() => them.evaluate(() => window.location.hash)).toBe('#/editor');
  await other.close();
});

test('a broken link says so and leaves the circuit as it was', async ({ page }) => {
  await openExample(page, 'jk');
  await page.goto('./#/editor?c=AAAA');
  await expect(page.locator('body')).toContainText('הקישור פגום');
  await expect(node(page, 'ff')).toBeVisible();
});
