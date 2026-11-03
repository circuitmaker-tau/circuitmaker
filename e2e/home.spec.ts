import { expect, test } from '@playwright/test';

test('the home page opens the editor and the guide', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('ריצוד');
  await page.getByRole('button', { name: 'פתיחת העורך' }).click();
  await expect(page.locator('.react-flow')).toBeVisible();
  await page.getByRole('button', { name: 'עזרה' }).click();
  await expect(page.locator('.help h1')).toHaveText('מדריך למשתמש');
});

test.describe('first visit', () => {
  // a browser that has never been here
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows the tour once', async ({ page }) => {
    await page.goto('./#/editor');
    const card = page.locator('.tour-card');
    await expect(card).toBeVisible();
    for (let i = 0; i < 6 && (await card.count()) > 0; i++)
      await card.locator('.tour-next').click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(card).toHaveCount(0);
  });
});
