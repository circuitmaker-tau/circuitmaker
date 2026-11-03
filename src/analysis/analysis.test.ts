/** TEST_CIRCUITS part D: the analysis module against hazards known from the course. */
import { describe, expect, it } from 'vitest';
import { asymmetric, mux2Fixed, staticZero } from '../examples/lessons';
import { mux2FromGates } from '../examples/mux2FromGates';
import { rippleAdder } from '../examples/rippleAdder';
import { jkFromClock } from '../examples/jkFromClock';
import { buildCircuit } from '../examples/build';
import { truthTable, twoLevel, unsupportedReason, variablesOf } from './func';
import { addConsensus } from './fix';
import { analyse, pathsFrom, scanTransitions } from './hazards';

const names = (c: Parameters<typeof variablesOf>[0]) => variablesOf(c).map((v) => v.id);
const cube = (vars: string[], c: Map<number, 0 | 1>) =>
  [...c]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => vars[k] + (v === 0 ? "'" : ''))
    .join('');

/** D1: F = X0·X1 + X1'·X2 from WK5, every Tp = 1. */
const wk5 = buildCircuit(
  'WK5',
  'ns',
  [
    ['X0', 'INPUT', 0, 0, { props: { value: 1 } }],
    ['X1', 'INPUT', 0, 100, { props: { value: 1 } }],
    ['X2', 'INPUT', 0, 200, { props: { value: 1 } }],
    ['nX1', 'NOT', 100, 100],
    ['a1', 'AND', 200, 0],
    ['a2', 'AND', 200, 150],
    ['F', 'OR', 300, 80],
  ],
  ['X1>nX1.in0', 'X0>a1.in0', 'X1>a1.in1', 'nX1>a2.in0', 'X2>a2.in1', 'a1>F.in0', 'a2>F.in1'],
);

describe('the function and its structure', () => {
  it('orders the variables as the course does', () => {
    expect(names(wk5)).toEqual(['X2', 'X1', 'X0']);
    expect(names(staticZero)).toEqual(['A', 'B', 'C']);
  });

  it('builds the truth table: F = Σ(3, 4, 5, 7) in the order X2X1X0', () => {
    const t = truthTable(wk5, 'F:out');
    expect(t.flatMap((v, m) => (v === 1 ? [m] : []))).toEqual([3, 4, 5, 7]);
  });

  it('recognises sums of products and products of sums, and nothing else', () => {
    expect(twoLevel(wk5, 'F:out')?.form).toBe('sop');
    expect(twoLevel(staticZero, 'Z:out')?.form).toBe('pos');
    expect(twoLevel(asymmetric, 'f:out')).toBeNull(); // AB ⊕ CD
  });

  it('refuses sequential circuits', () => {
    expect(unsupportedReason(jkFromClock)).not.toBeNull();
    expect(unsupportedReason(wk5)).toBeNull();
  });
});

describe('analytic hazards', () => {
  it('D1: static-1 between minterms 7 and 5 when X1 changes; consensus X0·X2', () => {
    const r = analyse(wk5, 'F:out')!;
    expect(r.hazards).toHaveLength(1);
    const h = r.hazards[0];
    expect(h.kind).toBe('static-1');
    expect(names(wk5)[h.variable]).toBe('X1');
    expect([...h.minterms].sort()).toEqual([5, 7]);
    expect(cube(names(wk5), h.consensus)).toBe('X2X0');
  });

  it('D2: the MUX of the exam demo; consensus I0·I1', () => {
    const h = analyse(mux2FromGates, 'o1:out')!.hazards;
    expect(h).toHaveLength(1);
    expect(names(mux2FromGates)[h[0].variable]).toBe('S0');
    expect(cube(names(mux2FromGates), h[0].consensus)).toBe('I1I0');
  });

  it('D3: homework 5 Q4 has only a static-0 hazard, when B changes with A = 1, C = 0', () => {
    const h = analyse(staticZero, 'Z:out')!.hazards;
    expect(h).toHaveLength(1);
    expect(h[0].kind).toBe('static-0');
    expect(names(staticZero)[h[0].variable]).toBe('B');
    // the consensus sum A' + C (it is 0 exactly at A = 1, C = 0)
    expect(cube(names(staticZero), h[0].consensus)).toBe("A'C");
  });

  it('D4: with the consensus term there is no hazard', () => {
    expect(analyse(mux2Fixed, 'o1:out')!.hazards).toEqual([]);
  });

  it('D5: f = AB ⊕ CD is not two-level, so only the simulation applies', () => {
    expect(analyse(asymmetric, 'f:out')).toBeNull();
  });
});

describe('hazards found by simulation, with the real delays', () => {
  it('the MUX glitches only when S0 falls with I0 = I1 = 1, for one Tp', () => {
    const found = scanTransitions(mux2FromGates, 'o1:out');
    expect(found).toHaveLength(1);
    const h = found[0];
    expect(h.kind).toBe('static-1');
    expect(names(mux2FromGates)[h.variable]).toBe('S0');
    expect(h.glitches).toEqual([{ start: 20, end: 30 }]);
  });

  it('the fixed MUX and the ripple-carry sum bit 0 never glitch', () => {
    expect(scanTransitions(mux2Fixed, 'o1:out')).toEqual([]);
  });

  it('homework 5: a static-0 pulse of width 10', () => {
    const found = scanTransitions(staticZero, 'Z:out');
    expect(found.map((h) => h.kind)).toEqual(['static-0']);
    expect(found[0].glitches).toEqual([{ start: 200, end: 300 }]);
  });

  it('also runs on circuits built from blocks (the ripple-carry adder)', () => {
    expect(() => scanTransitions(rippleAdder, 'FA2:S')).not.toThrow();
  });
});

describe('the paths that race', () => {
  it('S0 reaches the OR directly (2 Tp) and through the inverter (3 Tp)', () => {
    const p = pathsFrom(mux2FromGates, 'S0', 'o1:out');
    expect(p.map((x) => [x.through.join('→'), x.delay, x.inversions])).toEqual([
      ['a1→o1', 20, 0],
      ['n1→a2→o1', 30, 1],
    ]);
  });
});

describe('adding the consensus term', () => {
  it('removes the MUX glitch, as in the WK5 demo', () => {
    const r = analyse(mux2FromGates, 'o1:out')!;
    const fixed = addConsensus(mux2FromGates, r.structure, r.hazards[0].consensus);
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    expect(analyse(fixed.circuit, 'o1:out')!.hazards).toEqual([]);
    expect(scanTransitions(fixed.circuit, 'o1:out')).toEqual([]);
  });

  it('adds an inverter when the literal needs one and none exists', () => {
    const r = analyse(staticZero, 'Z:out')!;
    const fixed = addConsensus(staticZero, r.structure, r.hazards[0].consensus);
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    // A' + C: nA already inverts A, so only the OR gate is new
    expect(fixed.added).toHaveLength(1);
    expect(analyse(fixed.circuit, 'Z:out')!.hazards).toEqual([]);
    expect(scanTransitions(fixed.circuit, 'Z:out')).toEqual([]);
  });
});
