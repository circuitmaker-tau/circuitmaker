import { describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { createCircuit, createComponent, createWire } from '../model';
import { findGlitches } from './glitches';
import { Simulator } from './simulator';

describe('glitch detection (E8)', () => {
  it('finds the static-1 glitch of TC-H1 with width 1', () => {
    const sim = new Simulator(mux2FromGates);
    sim.setNet('S0:out', 0, 50);
    sim.runToEnd();
    expect(findGlitches(sim.trace('o1:out'))).toEqual([{ start: 70, end: 80, value: 0 }]);
    expect(findGlitches(sim.trace('a1:out'))).toEqual([]);
  });

  it('a pulse that spans an outside change is not a glitch', () => {
    // a plain buffer that follows a switch flipped twice
    const c = createCircuit();
    c.components.push(
      createComponent('INPUT', 'a', undefined, { props: { value: 0 } }),
      createComponent('BUF', 'b'),
    );
    c.wires.push(createWire('w1', ['a', 'out'], ['b', 'in0']));
    const sim = new Simulator(c);
    sim.setNet('a:out', 1, 10);
    sim.setNet('a:out', 0, 15);
    sim.runToEnd();
    expect(findGlitches(sim.trace('b:out'))).toEqual([]);
  });
});

describe('glitches in other exam circuits', () => {
  it('TC-H2: the static-0 pulse of Z, width 10', () => {
    const c = createCircuit();
    const add = (id: string, type: 'INPUT' | 'NOT' | 'OR' | 'AND', value?: 0 | 1) =>
      c.components.push(
        createComponent(
          type,
          id,
          undefined,
          type === 'INPUT' ? { props: { value } } : { delay: 10 },
        ),
      );
    add('A', 'INPUT', 1);
    add('B', 'INPUT', 0);
    add('C', 'INPUT', 0);
    add('nA', 'NOT');
    add('nB', 'NOT');
    add('X', 'OR');
    add('Y', 'OR');
    add('Z', 'AND');
    const w = (i: number, from: string, to: string, port: string) =>
      c.wires.push(createWire(`w${i}`, [from, 'out'], [to, port]));
    w(1, 'A', 'nA', 'in0');
    w(2, 'B', 'nB', 'in0');
    w(3, 'nA', 'X', 'in0');
    w(4, 'B', 'X', 'in1');
    w(5, 'nB', 'Y', 'in0');
    w(6, 'C', 'Y', 'in1');
    w(7, 'X', 'Z', 'in0');
    w(8, 'Y', 'Z', 'in1');
    const sim = new Simulator(c);
    sim.setNet('B:out', 1, 300);
    sim.runToEnd();
    expect(findGlitches(sim.trace('Z:out'))).toEqual([{ start: 500, end: 600, value: 1 }]);
  });

  it('TC-T1: the shortened Q2 pulses come from two different clock edges, so no glitch', () => {
    const c = createCircuit();
    c.components.push(
      createComponent('CLOCK', 'clk'),
      createComponent('CONST1', 'one'),
      createComponent('T_FF', 'ff', undefined, { delay: 0 }),
      createComponent('NOT', 'Q1', undefined, { delay: 0.5 }),
      createComponent('AND', 'Q2', undefined, { delay: 0.5 }),
    );
    c.wires.push(
      createWire('w1', ['one', 'out'], ['ff', 'T']),
      createWire('w2', ['clk', 'out'], ['ff', 'CLK']),
      createWire('w3', ['ff', 'Q'], ['Q1', 'in0']),
      createWire('w4', ['Q1', 'out'], ['Q2', 'in0']),
      createWire('w5', ['ff', "Q'"], ['Q2', 'in1']),
    );
    const sim = new Simulator(c);
    sim.runUntil(120);
    expect(findGlitches(sim.trace('Q2:out'))).toEqual([]);
  });
});

describe('planned switch changes (stimuli)', () => {
  it('reproduce TC-H1 exactly: S0 goes to 0 at t = 5', () => {
    const c = structuredClone(mux2FromGates);
    c.components.find((x) => x.id === 'S0')!.props = {
      value: 1,
      schedule: [{ time: 5, value: 0 }],
    };
    const sim = new Simulator(c);
    sim.runToEnd();
    const wave = sim
      .trace('o1:out')
      .map((t) => `${t.time / 10}:${t.value}`)
      .join(' ');
    expect(wave).toBe('0:1 7:0 8:1');
    expect(sim.external).toEqual([50]);
  });
});

describe('oscillation (E8)', () => {
  it('a ring of three inverters with Tp = 1 is reported, and keeps running', () => {
    const c = createCircuit();
    for (const id of ['n1', 'n2', 'n3']) c.components.push(createComponent('NOT', id));
    c.wires.push(
      createWire('w1', ['n1', 'out'], ['n2', 'in0']),
      createWire('w2', ['n2', 'out'], ['n3', 'in0']),
      createWire('w3', ['n3', 'out'], ['n1', 'in0']),
    );
    const sim = new Simulator(c);
    // the steady state of a ring is unknown; force one node to start it
    sim.setNet('n1:out', 0, 0);
    sim.runUntil(2000); // each net changes twice per period of 6, so 50 changes take ~150
    expect(sim.oscillating.size).toBeGreaterThan(0);
    expect(sim.warnings[0].message).toContain('תנודה');
    expect(sim.oscillation).toBeNull(); // not a zero-delay loop, so time goes on
    // period 6 (= 2 × 3 inverters × Tp 1)
    const t = sim
      .trace('n2:out')
      .slice(-3)
      .map((x) => x.time);
    expect(t[2] - t[0]).toBe(60);
  });
});
