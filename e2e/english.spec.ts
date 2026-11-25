import { expect, test } from '@playwright/test';

test('the language switch at the top: English left to right, remembered, and back to Hebrew', async ({
  page,
}) => {
  await page.goto('./#/editor');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('button', { name: 'New circuit', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Worlds' })).toContainText('Karnaugh maps');
  await expect(page.getByRole('button', { name: 'Skip to end', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // remembered after a reload, and on the home page too
  await page.reload();
  await expect(page.getByRole('button', { name: 'New circuit', exact: true })).toBeVisible();
  await page.goto('./#/');
  await expect(page.getByRole('button', { name: 'Open the editor', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'עברית', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('button', { name: 'פתיחת העורך', exact: true })).toBeVisible();

  // a link can ask for a language
  await page.goto('./?lang=en#/editor');
  await expect(page.getByRole('button', { name: 'New circuit', exact: true })).toBeVisible();
});
