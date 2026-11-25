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

test('in English: an example explains itself in English, and a self-practice question is set and graded in English', async ({
  page,
}) => {
  await page.goto('./?lang=en#/editor');
  await page.locator('select.examples').selectOption('ffchain');
  await expect(page.getByText('What to learn here')).toBeVisible();
  await expect(page.getByText(/all on the same clock, starting from 000/)).toBeVisible();

  await page.getByRole('tab', { name: 'Self-practice' }).click();
  await page.getByRole('button', { name: 'Medium' }).click();
  await page.getByRole('button', { name: 'New question' }).click();
  const title = page.locator('.exercise-question h3');
  await expect(title).not.toHaveText(/[֐-׿]/);
  await page.getByRole('button', { name: 'Show a solution' }).click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.locator('.exercise-score b')).toHaveText('100/100');
  await expect(page.locator('.exercise-notes')).toContainText('Every rule of the question was kept');

  // the question on the screen follows the switch back to Hebrew
  await page.getByRole('button', { name: 'עברית', exact: true }).click();
  await expect(title).toHaveText(/[֐-׿]/);
});
