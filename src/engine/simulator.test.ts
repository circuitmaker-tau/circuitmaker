/**
 * Golden waveforms from TEST_CIRCUITS.md part A. Every expected value was
 * computed by reference_sim.py and checked against the course's own solutions
 * (WK5 slides, HW5 Q4, recitation 5). Format: "time:value" in time units.
 */
import { describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { createCircuit, createComponent, createWire } from '../model';
import type { Circuit, ComponentProps, ComponentType } from '../model';
import { Simulator } from './simulator';

const wave = (sim: Simulator, net: string) =>
  sim
    .trace(net)
    .map((t) => `${t.time / 10}:${t.value}`)
    .join(' ');

/** Build a gate-level circuit from a compact description. */
function build(
  parts: [
    id: string,
    type: ComponentType,
    delay?: number,
    props?: ComponentProps,
    inputs?: number,
  ][],
  wires: [from: string, to: string][],
): Circuit {
  const c = createCircuit();
  for (const [id, type, delay, props, inputs] of parts) {
    const comp = createComponent(type, id, undefined, { props });
    if (delay !== undefined) comp.delay = delay;
    if (inputs !== undefined) comp.inputs = inputs;
    c.components.push(comp);
  }
  wires.forEach(([from, to], i) => {
    const [fc, fp] = from.split('.');
    const [tc, tp] = to.split('.');
    c.wires.push(createWire(`w${i + 1}`, [fc, fp ?? 'out'], [tc, tp]));
  });
  return c;
}

describe('TC-H1: static-1 hazard, MUX 2:1 from gates, every Tp = 1 (WK5)', () => {
  it('F drops to 0 between t = 7 and t = 8', () => {
    const sim = new Simulator(mux2FromGates);
    sim.setNet('S0:out', 0, 50); // S0: 1 -> 0 at t = 5
    sim.runToEnd();
    expect(wave(sim, 'n1:out')).toBe('0:0 6:1');
    expect(wave(sim, 'a1:out')).toBe('0:1 6:0');
    expect(wave(sim, 'a2:out')).toBe('0:0 7:1');
    expect(wave(sim, 'o1:out')).toBe('0:1 7:0 8:1');
  });

  it('adding the consensus term I0·I1 removes the glitch', () => {
    const fixed = structuredClone(mux2FromGates);
    fixed.components.push(createComponent('AND', 'a3'));
    fixed.components.find((c) => c.id === 'o1')!.inputs = 3;
    fixed.wires.push(
      createWire('w9', ['I0', 'out'], ['a3', 'in0']),
      createWire('w10', ['I1', 'out'], ['a3', 'in1']),
      createWire('w11', ['a3', 'out'], ['o1', 'in2']),
    );
    const sim = new Simulator(fixed);
    sim.setNet('S0:out', 0, 50);
    sim.runToEnd();
    expect(wave(sim, 'o1:out')).toBe('0:1');
  });
});

describe('TC-H2: static-0 hazard, every Tp = 10 (HW5 Q4)', () => {
  it('Z pulses to 1 between t = 50 and t = 60', () => {
    // X = A' + B, Y = B' + C, Z = X·Y; A = 1, C = 0, B rises at t = 30
    const c = build(
      [
        ['A', 'INPUT', 0, { value: 1 }],
        ['B', 'INPUT', 0, { value: 0 }],
        ['C', 'INPUT', 0, { value: 0 }],
        ['nA', 'NOT', 10],
        ['nB', 'NOT', 10],
        ['X', 'OR', 10],
        ['Y', 'OR', 10],
        ['Z', 'AND', 10],
      ],
      [
        ['A', 'nA.in0'],
        ['B', 'nB.in0'],
        ['nA', 'X.in0'],
        ['B', 'X.in1'],
        ['nB', 'Y.in0'],
        ['C', 'Y.in1'],
        ['X', 'Z.in0'],
        ['Y', 'Z.in1'],
      ],
    );
    const sim = new Simulator(c);
    sim.setNet('B:out', 1, 300);
    sim.runToEnd();
    expect(wave(sim, 'X:out')).toBe('0:0 40:1');
    expect(wave(sim, 'Y:out')).toBe('0:1 50:0');
    expect(wave(sim, 'Z:out')).toBe('0:0 50:1 60:0');
  });
});

describe('TC-H3: different rise and fall delays (recitation 5)', () => {
  it('f = AB ⊕ CD glitches between t = 75 and t = 85', () => {
    // AND: tpLH = 10, tpHL = 20; XOR: 5; ABCD goes 1100 -> 1011 at t = 60
    const and = { tpLH: 10, tpHL: 20 };
    const c = build(
      [
        ['A', 'INPUT', 0, { value: 1 }],
        ['B', 'INPUT', 0, { value: 1 }],
        ['C', 'INPUT', 0, { value: 0 }],
        ['D', 'INPUT', 0, { value: 0 }],
        ['I1', 'AND', 10, and],
        ['I2', 'AND', 10, and],
        ['f', 'XOR', 5],
      ],
      [
        ['A', 'I1.in0'],
        ['B', 'I1.in1'],
        ['C', 'I2.in0'],
        ['D', 'I2.in1'],
        ['I1', 'f.in0'],
        ['I2', 'f.in1'],
      ],
    );
    const sim = new Simulator(c);
    sim.setNet('B:out', 0, 600);
    sim.setNet('C:out', 1, 600);
    sim.setNet('D:out', 1, 600);
    sim.runToEnd();
    expect(wave(sim, 'I1:out')).toBe('0:1 80:0');
    expect(wave(sim, 'I2:out')).toBe('0:0 70:1');
    expect(wave(sim, 'f:out')).toBe('0:1 75:0 85:1');
  });
});

describe('engine rules', () => {
  it('a pulse shorter than Tp still reaches the output (E2)', () => {
    const c = build(
      [
        ['a', 'INPUT', 0, { value: 0 }],
        ['b', 'BUF', 2],
      ],
      [['a', 'b.in0']],
    );
    const sim = new Simulator(c);
    sim.setNet('a:out', 1, 10);
    sim.setNet('a:out', 0, 15); // 0.5 wide, Tp = 2
    sim.runToEnd();
    expect(wave(sim, 'b:out')).toBe('0:0 3:1 3.5:0');
  });

  it('decimal Tp is exact (E1)', () => {
    const c = build(
      [
        ['a', 'INPUT', 0, { value: 0 }],
        ['n1', 'NOT', 0.1],
        ['n2', 'NOT', 0.2],
      ],
      [
        ['a', 'n1.in0'],
        ['n1', 'n2.in0'],
      ],
    );
    const sim = new Simulator(c);
    sim.setNet('a:out', 1, 0);
    sim.runToEnd();
    expect(wave(sim, 'n2:out')).toBe('0:0 0.3:1');
  });

  it('steps from one change to the next', () => {
    const sim = new Simulator(mux2FromGates);
    sim.setNet('S0:out', 0, 50);
    const times: number[] = [];
    while (sim.step()) times.push(sim.now / 10);
    expect(times).toEqual([5, 6, 7, 8]);
    expect(sim.idle).toBe(true);
  });

  it('stops a zero-delay loop and reports it (E3)', () => {
    // x = a ⊕ n and n = x', all Tp = 0: with a = 0 it can never settle
    const c = build(
      [
        ['a', 'INPUT', 0, { value: 0 }],
        ['x', 'XOR', 0],
        ['n', 'NOT', 0],
      ],
      [
        ['a', 'x.in0'],
        ['n', 'x.in1'],
        ['x', 'n.in0'],
      ],
    );
    const sim = new Simulator(c);
    sim.setNet('n:out', 0, 10);
    sim.runToEnd();
    expect(sim.oscillation).not.toBeNull();
    expect(sim.oscillation?.time).toBe(10);
  });
});

describe('changes in flight (wire animation)', () => {
  it('lists each new value travelling through a delay, and only real changes', () => {
    const sim = new Simulator(mux2FromGates);
    sim.setNet('S0:out', 0, 0);
    sim.runUntil(5); // half way through the first Tp
    const flight = sim.inFlight();
    expect(flight.get('n1:out')).toEqual([{ from: 0, at: 10, value: 1 }]);
    expect(flight.get('a1:out')).toEqual([{ from: 0, at: 10, value: 0 }]);
    // a2 and o1 were re-evaluated to the value they already have: nothing to show
    expect(flight.has('o1:out')).toBe(false);
    sim.runToEnd();
    expect(sim.inFlight().size).toBe(0);
  });
});
