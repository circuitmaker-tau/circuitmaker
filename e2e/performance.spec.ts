/**
 * Work plan, non-functional: about 60 frames per second with 200 components.
 * The fixture has 232 components and 231 wires, all changing all the time.
 * CI machines are slower and share their CPU, so the bar here is lower than
 * the target; the measured rate is printed and attached to the report.
 * Not on the phone project: an emulated iPhone runs on the CI machine's CPU.
 */
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// measured on every engine: Chromium, Firefox and WebKit (Safari)
test('playback stays smooth with 232 components', async ({ page, browserName }, info) => {
  await page.goto('./#/editor');
  await page
    .locator('input[type=file]')
    .setInputFiles(fileURLToPath(new URL('./fixtures/perf200.json', import.meta.url)));
  await expect(page.locator('.react-flow__node')).toHaveCount(232);
  await page.getByRole('button', { name: 'הפעלה', exact: true }).click();
  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - start < 4000) requestAnimationFrame(tick);
          else resolve(frames / ((performance.now() - start) / 1000));
        };
        requestAnimationFrame(tick);
      }),
  );
  info.annotations.push({ type: 'fps', description: fps.toFixed(1) });
  console.log(`${browserName}: playback with 232 components: ${fps.toFixed(1)} fps`);
  // Firefox and WebKit draw without a GPU on the CI machines, so their bar is lower
  expect(fps).toBeGreaterThan(browserName === 'chromium' ? 25 : 15);
});
