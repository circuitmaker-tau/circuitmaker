import { describe, expect, it } from 'vitest';
import { asymmetric, norLatch, tffPulses } from '../examples/lessons';
import { mux2FromGates } from '../examples/mux2FromGates';
import { rippleAdder } from '../examples/rippleAdder';
import { criticalPaths } from './critical';

const critical = (c: Parameters<typeof criticalPaths>[0]) => {
  const r = criticalPaths(c);
  if (!r.ok) throw new Error(r.reason);
  return r.paths[0];
};

describe('critical path (WK5)', () => {
  it('MUX 2:1 from gates: S0 through the inverter, an AND and the OR, 3 Tp in 3 levels', () => {
    const p = critical(mux2FromGates);
    expect(p.end).toBe('F');
    expect(p.delay).toBe(30);
    expect(p.levels).toBe(3);
    expect(p.components).toEqual(['S0', 'n1', 'a2', 'o1']);
    expect(p.wires).toHaveLength(4);
  });

  it('counts the worse of tpLH and tpHL (recitation 5: AND 20, XOR 5)', () => {
    expect(critical(asymmetric).delay).toBe(250);
  });

  it('ripple-carry adder: the carry passes all four full adders', () => {
    const r = criticalPaths(rippleAdder);
    if (!r.ok) throw new Error(r.reason);
    expect(r.paths[0]).toMatchObject({ end: 'Cout', delay: 40, levels: 4 });
    // S0 only waits for FA0
    expect(r.paths.find((p) => p.end === 'S0')!.delay).toBe(10);
  });

  it('a flip-flop starts a path at Q, and a constant starts none', () => {
    const r = criticalPaths(tffPulses);
    if (!r.ok) throw new Error(r.reason);
    expect(r.paths[0]).toMatchObject({ end: 'L', delay: 10 });
    expect(r.paths.some((p) => p.end === 'ff.T')).toBe(false);
  });

  it('a latch built from gates is a loop, so there is no critical path', () => {
    const r = criticalPaths(norLatch);
    expect(r.ok).toBe(false);
  });
});
