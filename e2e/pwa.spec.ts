import { expect, test } from '@playwright/test';

test('can be installed: a manifest with icons, and the app opens offline after a visit', async ({ page, context, browserName }) => {
  const manifest = await page.request.get('./manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const data = await manifest.json();
  expect(data.display).toBe('standalone');
  for (const icon of data.icons) expect((await page.request.get(`./${icon.src}`)).ok()).toBe(true);

  // service workers in Playwright are reliable in Chromium; the other engines only check the manifest
  test.skip(browserName !== 'chromium', 'offline check runs in Chromium');
  await page.goto('./#/editor');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now the worker controls the page and keeps what it loads
  await expect(page.locator('select.examples')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('select.examples')).toBeVisible();
  await context.setOffline(false);
});
