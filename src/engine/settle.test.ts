import { describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { createCircuit, createComponent, createWire } from '../model';
import type { Circuit } from '../model';
import { settle } from './settle';

const withInputs = (values: Record<string, 0 | 1>): Circuit => {
  const c = structuredClone(mux2FromGates);
  for (const comp of c.components) {
    if (comp.id in values) comp.props = { value: values[comp.id] };
  }
  return c;
};

const lamp = (c: Circuit) => settle(c).inputs.get('F:in');

describe("steady state of the MUX 2:1 (f = S0'·I0 + S0·I1)", () => {
  it('follows the full truth table', () => {
    for (const S0 of [0, 1] as const) {
      for (const I0 of [0, 1] as const) {
        for (const I1 of [0, 1] as const) {
          const expected = S0 === 1 ? I1 : I0;
          expect(lamp(withInputs({ S0, I0, I1 }))).toBe(expected);
        }
      }
    }
  });

  it('gives every wire a value', () => {
    const { nets } = settle(withInputs({ S0: 1, I0: 1, I1: 1 }));
    expect(nets.get('n1:out')).toBe(0);
    expect(nets.get('a1:out')).toBe(1);
    expect(nets.get('a2:out')).toBe(0);
    expect(nets.get('o1:out')).toBe(1);
  });
});

describe('unknown values (rule E7)', () => {
  it('an unconnected input reads X, and X spreads only where it matters', () => {
    const c = createCircuit();
    c.components.push(
      createComponent('INPUT', 'a', undefined, { props: { value: 1 } }),
      createComponent('AND', 'g'),
      createComponent('OR', 'h'),
      createComponent('OUTPUT', 'f'),
    );
    c.wires.push(
      createWire('w1', ['a', 'out'], ['g', 'in0']), // g.in1 left open -> X
      createWire('w2', ['g', 'out'], ['h', 'in0']),
      createWire('w3', ['a', 'out'], ['h', 'in1']), // OR with a 1 is 1 regardless
      createWire('w4', ['h', 'out'], ['f', 'in']),
    );
    const { nets, inputs } = settle(c);
    expect(nets.get('g:out')).toBe('X');
    expect(inputs.get('f:in')).toBe(1);
  });

  it('a NOR latch that was never set stays X', () => {
    const c = createCircuit();
    c.components.push(
      createComponent('CONST0', 's'),
      createComponent('CONST0', 'r'),
      createComponent('NOR', 'q'),
      createComponent('NOR', 'qb'),
    );
    c.wires.push(
      createWire('w1', ['r', 'out'], ['q', 'in0']),
      createWire('w2', ['qb', 'out'], ['q', 'in1']),
      createWire('w3', ['s', 'out'], ['qb', 'in0']),
      createWire('w4', ['q', 'out'], ['qb', 'in1']),
    );
    expect(settle(c).nets.get('q:out')).toBe('X');
  });

  it('a set NOR latch settles to Q = 1', () => {
    const c = createCircuit();
    c.components.push(
      createComponent('CONST1', 's'),
      createComponent('CONST0', 'r'),
      createComponent('NOR', 'q'),
      createComponent('NOR', 'qb'),
    );
    c.wires.push(
      createWire('w1', ['r', 'out'], ['q', 'in0']),
      createWire('w2', ['qb', 'out'], ['q', 'in1']),
      createWire('w3', ['s', 'out'], ['qb', 'in0']),
      createWire('w4', ['q', 'out'], ['qb', 'in1']),
    );
    const { nets } = settle(c);
    expect(nets.get('qb:out')).toBe(0);
    expect(nets.get('q:out')).toBe(1);
  });

  it('a loop of inverters with no stable state stays X instead of hanging', () => {
    const c = createCircuit();
    c.components.push(
      createComponent('NOT', 'n1'),
      createComponent('NOT', 'n2'),
      createComponent('NOT', 'n3'),
    );
    c.wires.push(
      createWire('w1', ['n1', 'out'], ['n2', 'in0']),
      createWire('w2', ['n2', 'out'], ['n3', 'in0']),
      createWire('w3', ['n3', 'out'], ['n1', 'in0']),
    );
    expect(settle(c).nets.get('n1:out')).toBe('X');
  });
});
