import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluation';

describe('detection rate of the analysis (random sums of products)', () => {
  it('reports every static hazard the simulation can show, and only those', () => {
    const e = evaluate(30, 20);
    expect(e.reported).toBeGreaterThan(30);
    expect(e.confirmed).toBe(e.reported); // no false alarms
    expect(e.missed).toBe(0); // no misses
  });
});
