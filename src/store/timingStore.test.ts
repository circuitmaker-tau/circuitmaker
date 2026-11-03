import { beforeEach, describe, expect, it } from 'vitest';
import { downCounter } from '../examples/downCounter';
import { jkFromClock } from '../examples/jkFromClock';
import { mux2FromGates } from '../examples/mux2FromGates';
import { allRows, defaultProbes, useTimingStore } from './timingStore';

beforeEach(() => useTimingStore.getState().resetProbes());

describe('timing diagram rows', () => {
  it('a small circuit shows every net, switches first and the lamp last', () => {
    const rows = allRows(mux2FromGates);
    expect(rows.map((r) => r.label)).toEqual(['I0', 'I1', 'S0', 'n1', 'a1', 'a2', 'F (o1)']);
    expect(rows.filter((r) => r.source).map((r) => r.label)).toEqual(['I0', 'I1', 'S0']);
    expect(defaultProbes(mux2FromGates)).toHaveLength(7);
  });

  it('the clock comes first and flip-flop outputs are named id.port', () => {
    expect(allRows(jkFromClock).map((r) => r.label)).toEqual([
      'CLK',
      'nJ',
      'nK',
      "ff.Q'",
      'Q (ff.Q)',
    ]);
  });

  it('a larger circuit shows the clock, the switches, the Q outputs and the lamps', () => {
    const nets = defaultProbes(downCounter);
    expect(nets).toContain('CLK:out');
    expect(nets).toContain('J0:Q');
    expect(nets).not.toContain("J0:Q'");
    expect(nets).not.toContain('a1:out');
  });

  it('nets can be added and removed, and keep their order', () => {
    const { setProbe, shown } = useTimingStore.getState();
    setProbe(downCounter, 'a1:out', true);
    expect(shown(downCounter)).toContain('a1:out');
    setProbe(downCounter, 'CLK:out', false);
    expect(shown(downCounter)).not.toContain('CLK:out');
    const order = allRows(downCounter).map((r) => r.net);
    const s = shown(downCounter);
    expect([...s].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(s);
  });
});
