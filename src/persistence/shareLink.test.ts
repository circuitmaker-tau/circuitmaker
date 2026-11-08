import { describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { decodeShare, encodeShare, sharedData, shareUrl } from './shareLink';

describe('share link', () => {
  it('carries the circuit and the note, and comes back the same', async () => {
    const data = await encodeShare(mux2FromGates, '  שנו את S0 ומדדו את הריצוד  ');
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/); // safe in an address as it is
    const back = await decodeShare(data);
    expect(back).toEqual({ ok: true, circuit: mux2FromGates, note: 'שנו את S0 ומדדו את הריצוד' });
  });

  it('is short enough for a chat message for the course examples', async () => {
    const data = await encodeShare(mux2FromGates);
    expect(data.length).toBeLessThan(1500);
    expect((await decodeShare(data)).ok).toBe(true);
  });

  it('explains a link that was cut or is not a circuit', async () => {
    const data = await encodeShare(mux2FromGates);
    const cut = await decodeShare(data.slice(0, data.length / 2));
    expect(cut.ok).toBe(false);
    const junk = await decodeShare('hello');
    expect(junk.ok).toBe(false);
    if (!junk.ok) expect(junk.error).toContain('הקישור');
  });

  it('builds and reads the address: #/editor?c=…', () => {
    const url = shareUrl('abc_-1', { origin: 'https://circuitmaker-tau.github.io', pathname: '/circuitmaker/' });
    expect(url).toBe('https://circuitmaker-tau.github.io/circuitmaker/#/editor?c=abc_-1');
    expect(sharedData(new URL(url).hash)).toBe('abc_-1');
    expect(sharedData('#/editor')).toBeNull();
  });
});
