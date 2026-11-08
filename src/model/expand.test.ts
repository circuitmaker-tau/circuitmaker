import { describe, expect, it } from 'vitest';
import { Simulator } from '../engine/simulator';
import { CATALOG, inputsOfComponent, outputPortsOf } from './catalog';
import { canExpand, expandComponent } from './expand';
import { createComponent, createWire } from './factory';
import type { Circuit, ComponentType } from './types';
import { validateCircuit } from './validate';

/** A switch for every input of one block and a lamp for every output. */
function harness(type: ComponentType, values: (0 | 1)[] = []): Circuit {
  const block = createComponent(type, 'B', { x: 300, y: 0 });
  const ins = inputsOfComponent(block);
  const outs = outputPortsOf(type);
  return {
    version: 1,
    name: type,
    timeUnit: 'ns',
    components: [
      block,
      ...ins.map((p, i) => createComponent('INPUT', `i_${p}`, { x: 0, y: 60 * i }, { props: { value: values[i] ?? 0 } })),
      ...outs.map((p, i) => createComponent('OUTPUT', `o_${p}`, { x: 700, y: 60 * i })),
    ],
    wires: [
      ...ins.map((p, i) => createWire(`wi${i}`, [`i_${p}`, 'out'], ['B', p])),
      ...outs.map((p, i) => createWire(`wo${i}`, ['B', p], [`o_${p}`, 'in'])),
    ],
  };
}

/** Steady value seen by every lamp. */
function lamps(c: Circuit): Record<string, unknown> {
  const sim = new Simulator(c);
  const seen: Record<string, unknown> = {};
  for (const lamp of c.components.filter((x) => x.type === 'OUTPUT')) {
    const w = c.wires.find((x) => x.to.component === lamp.id)!;
    seen[lamp.id] = sim.value(`${w.from.component}:${w.from.port}`);
  }
  return seen;
}

/** Take apart everything that can be, again and again, down to gates and flip-flops. */
function expandAll(c: Circuit): Circuit {
  for (;;) {
    const next = c.components.find((x) => canExpand(x.type));
    if (!next) return c;
    c = expandComponent(c, next.id)!.circuit;
  }
}


const COMBINATIONAL: ComponentType[] = ['HALF_ADDER', 'FULL_ADDER', 'MUX2', 'MUX4', 'MUX8', 'MUX16', 'DEC2x4', 'DEC3x8', 'PRIORITY_ENC4x2'];

describe('taking a block apart', () => {
  for (const type of COMBINATIONAL) {
    it(`${type}: the parts, and the parts of the parts, compute the same outputs`, () => {
      const n = inputsOfComponent(createComponent(type, 'B')).length;
      const combos = n <= 11 ? Array.from({ length: 1 << n }, (_, m) => m) : Array.from({ length: 300 }, (_, k) => (k * 2654435761) >>> (32 - n));
      for (const m of combos) {
        const values = Array.from({ length: n }, (_, i) => ((m >> i) & 1) as 0 | 1);
        const block = harness(type, values);
        const once = expandComponent(block, 'B')!.circuit;
        const all = expandAll(block);
        expect(lamps(once)).toEqual(lamps(block));
        expect(lamps(all)).toEqual(lamps(block));
      }
    });
  }

  it('a full adder becomes two half adders and an OR, then XOR, AND and OR gates only', () => {
    const r = expandComponent(harness('FULL_ADDER'), 'B')!;
    expect(r.parts).toEqual(['B_h1', 'B_h2', 'B_o']);
    expect(r.circuit.components.filter((c) => c.type === 'HALF_ADDER')).toHaveLength(2);
    const gates = expandAll(harness('FULL_ADDER')).components.filter((c) => !['INPUT', 'OUTPUT'].includes(c.type));
    expect(gates.map((c) => c.type).sort()).toEqual(['AND', 'AND', 'OR', 'XOR', 'XOR']);
    expect(validateCircuit(r.circuit).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('MUX 4:1 becomes three MUX 2:1, as in the recursive build', () => {
    const r = expandComponent(harness('MUX4'), 'B')!;
    expect(r.circuit.components.filter((c) => c.type === 'MUX2')).toHaveLength(3);
    // S0 drives both first-level MUXes, S1 the one that chooses
    const s0 = r.circuit.wires.filter((w) => w.from.component === 'i_S0').map((w) => `${w.to.component}.${w.to.port}`);
    const s1 = r.circuit.wires.filter((w) => w.from.component === 'i_S1').map((w) => `${w.to.component}.${w.to.port}`);
    expect(s0.sort()).toEqual(['B_m0.S0', 'B_m1.S0']);
    expect(s1).toEqual(['B_t.S0']);
  });

  it('the parts take the Tp of the block, so the whole is slower, as built from real gates', () => {
    const c = harness('MUX2');
    c.components[0].delay = 2;
    const r = expandComponent(c, 'B')!;
    expect(r.circuit.components.filter((x) => r.parts.includes(x.id)).every((x) => x.delay === 2)).toBe(true);
  });

  it('a counter becomes a synchronous counter of T flip-flops that counts the same, with RESET', () => {
    const c: Circuit = {
      version: 1,
      name: 'counter',
      timeUnit: 'ns',
      components: [
        createComponent('CLOCK', 'clk', { x: 0, y: 0 }, { props: { halfPeriod: 10 } }),
        createComponent('INPUT', 'rst', { x: 0, y: 100 }, { props: { value: 0, schedule: [{ time: 125, value: 1 }, { time: 135, value: 0 }] } }),
        createComponent('COUNTER4', 'cnt', { x: 200, y: 0 }),
        ...[0, 1, 2, 3].map((i) => createComponent('OUTPUT', `q${i}`, { x: 400, y: 60 * i })),
      ],
      wires: [
        createWire('w1', ['clk', 'out'], ['cnt', 'CLK']),
        createWire('w2', ['rst', 'out'], ['cnt', 'RESET']),
        ...[0, 1, 2, 3].map((i) => createWire(`q${i}w`, ['cnt', `Q${i}`], [`q${i}`, 'in'])),
      ],
    };
    const parts = expandAll(c);
    expect(parts.components.filter((x) => x.type === 'T_FF')).toHaveLength(4);
    const sample = (circuit: Circuit) => {
      const sim = new Simulator(circuit);
      const nets = [0, 1, 2, 3].map((i) => {
        const w = circuit.wires.find((x) => x.to.component === `q${i}`)!;
        return `${w.from.component}:${w.from.port}`;
      });
      const seen: string[] = [];
      // just before every rising edge (at 10, 30, 50, … units), when everything has settled
      for (let t = 290; t <= 3900; t += 200) {
        sim.runUntil(t);
        seen.push(nets.map((n) => sim.value(n)).reverse().join(''));
      }
      return seen;
    };
    const counted = sample(c);
    expect(counted.slice(0, 5)).toEqual(['0001', '0010', '0011', '0100', '0101']);
    expect(sample(parts)).toEqual(counted);
  });

  it('keeps a wire from the block back to itself (a register that shifts Q0 into D1)', () => {
    const c = harness('REGISTER4');
    c.wires = c.wires.filter((w) => !(w.to.component === 'B' && w.to.port === 'D1'));
    c.components = c.components.filter((x) => x.id !== 'i_D1');
    c.wires.push(createWire('fb', ['B', 'Q0'], ['B', 'D1']));
    const r = expandComponent(c, 'B')!;
    expect(r.circuit.wires.some((w) => w.from.component === 'B_d0' && w.from.port === 'Q' && w.to.component === 'B_d1' && w.to.port === 'D')).toBe(true);
    expect(r.circuit.wires.some((w) => w.from.component === 'B' || w.to.component === 'B')).toBe(false);
  });

  it('gates, flip-flops and the plain encoder stay as they are', () => {
    for (const type of ['AND', 'NOT', 'D_FF', 'JK_FF', 'ENC4x2', 'INPUT'] as ComponentType[]) {
      expect(canExpand(type)).toBe(false);
    }
    expect(Object.keys(CATALOG).filter((t) => canExpand(t as ComponentType)).length).toBe(11);
  });
});
