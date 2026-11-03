import { expect, test } from '@playwright/test';
import { button, lamp, openExample } from './helpers';

test('exam 2026B: the JK flip-flop toggles at t = 2, 4, 6', async ({ page }) => {
  await openExample(page, 'jk');
  const q: string[] = [];
  for (let i = 0; i < 3; i++) {
    await button(page, 'מחזור').click();
    q.push(await lamp(page, 'Q').innerText());
  }
  expect(q).toEqual(['1', '0', '1']);
  await expect(page.locator('.sim-time')).toContainText('6.0');
});

test('exam 2025A: the down counter counts 1111, 1110, 1101', async ({ page }) => {
  await openExample(page, 'down');
  const words: string[] = [];
  for (let i = 0; i < 3; i++) {
    await button(page, 'מחזור').click();
    const bits = await Promise.all(
      ['Q3', 'Q2', 'Q1', 'Q0'].map((id) => lamp(page, id).innerText()),
    );
    words.push(bits.join(''));
  }
  expect(words).toEqual(['1111', '1110', '1101']);
});
