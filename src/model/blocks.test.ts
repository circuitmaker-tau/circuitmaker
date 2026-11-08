import { describe, expect, it } from 'vitest';
import { criticalPaths } from '../analysis/critical';
import { Simulator } from '../engine/simulator';
import { mux2FromGates } from '../examples/mux2FromGates';
import { blockFromSelection, blockInstance, flattenBlocks } from './blocks';
import { expandComponent } from './expand';
import { createComponent, createWire } from './factory';
import { parseCircuit, serializeCircuit } from './serialize';
import type { BlockDef, Circuit } from './types';
import { validateCircuit } from './validate';

/** MUX 2:1 from gates (every Tp = 1), saved as a block: inputs S0, I1, I0 (top to bottom), output F. */
function mux2Block(): BlockDef {
  const r = blockFromSelection(mux2FromGates, mux2FromGates.components.map((c) => c.id), 'MUX2g');
  if (!r.ok) throw new Error(r.error);
  return r.block;
}

/** MUX 4:1 from three of them (WK6B): B1 and B2 choose by S0, B3 by S1. */
function mux4(values: number): Circuit {
  const def = mux2Block();
  const bit = (i: number) => ((values >> i) & 1) as 0 | 1;
  const sw = (id: string, i: number) => createComponent('INPUT', id, { x: 0, y: 60 * i }, { props: { value: bit(i) } });
  return {
    version: 1,
    name: 'MUX 4:1 משלושה MUX 2:1',
    timeUnit: 'ns',
    blocks: [def],
    components: [
      sw('I0', 0), sw('I1', 1), sw('I2', 2), sw('I3', 3), sw('S0', 4), sw('S1', 5),
      blockInstance(def, 'B1', { x: 200, y: 0 }),
      blockInstance(def, 'B2', { x: 200, y: 200 }),
      blockInstance(def, 'B3', { x: 400, y: 100 }),
      createComponent('OUTPUT', 'F', { x: 600, y: 100 }),
    ],
    wires: [
      createWire('w1', ['I0', 'out'], ['B1', 'I0']),
      createWire('w2', ['I1', 'out'], ['B1', 'I1']),
      createWire('w3', ['I2', 'out'], ['B2', 'I0']),
      createWire('w4', ['I3', 'out'], ['B2', 'I1']),
      createWire('w5', ['S0', 'out'], ['B1', 'S0']),
      createWire('w6', ['S0', 'out'], ['B2', 'S0']),
      createWire('w7', ['B1', 'F'], ['B3', 'I0']),
      createWire('w8', ['B2', 'F'], ['B3', 'I1']),
      createWire('w9', ['S1', 'out'], ['B3', 'S0']),
      createWire('w10', ['B3', 'F'], ['F', 'in']),
    ],
  };
}

describe("the student's own blocks", () => {
  it('saves a selection: switches become inputs and lamps outputs, top to bottom', () => {
    const def = mux2Block();
    expect(def.inputs).toEqual(['S0', 'I1', 'I0']);
    expect(def.outputs).toEqual(['F']);
    expect(def.components).toHaveLength(8);
    const none = blockFromSelection(mux2FromGates, ['n1', 'a1'], 'X');
    expect(none.ok).toBe(false);
    const taken = blockFromSelection({ ...mux2FromGates, blocks: [def] }, ['S0', 'n1', 'F'], 'MUX2g');
    expect(taken.ok).toBe(false);
  });

  it('a MUX 4:1 from three MUX 2:1 blocks selects the right input for all 64 inputs', () => {
    for (let m = 0; m < 64; m++) {
      const c = mux4(m);
      expect(validateCircuit(c).filter((i) => i.severity === 'error')).toEqual([]);
      const sel = ((m >> 4) & 1) | (((m >> 5) & 1) << 1);
      expect(new Simulator(c).value('B3:F')).toBe((m >> sel) & 1);
    }
  });

  it('keeps the gates inside with their own Tp: the static-1 hazard of the MUX shows through the block', () => {
    const c = mux4(0b011111); // I0..I3 = 1, S0 = 1, S1 = 0
    c.components = c.components.map((x) =>
      x.id === 'S0' ? { ...x, props: { value: 1, schedule: [{ time: 5, value: 0 }] } } : x,
    );
    const sim = new Simulator(c);
    sim.runToEnd();
    // inside B1: F falls at t = 7 and is back at t = 8 (TC-H1), and B3 passes the glitch on 2 Tp later
    expect(sim.trace('B1:F').map((t) => [t.time, t.value])).toEqual([[0, 1], [70, 0], [80, 1]]);
    expect(sim.trace('B3:F').map((t) => [t.time, t.value])).toEqual([[0, 1], [90, 0], [100, 1]]);
  });

  it('an unconnected input of a block is X inside it', () => {
    const c = mux4(0);
    c.wires = c.wires.filter((w) => w.id !== 'w9'); // S1 not connected
    expect(new Simulator(c).value('B3:F')).toBe(0); // both data inputs are 0, so it is 0 anyway
    // built from gates, an X select gives X even when both data inputs are 1 (no consensus term)
    const ones = mux4(0b000101); // B1 = I0 = 1, B2 = I2 = 1
    ones.wires = ones.wires.filter((w) => w.id !== 'w9');
    expect(new Simulator(ones).value('B3:F')).toBe('X');
    const differ = mux4(0b000001); // B1 → 1, B2 → 0
    differ.wires = differ.wires.filter((w) => w.id !== 'w9');
    expect(new Simulator(differ).value('B3:F')).toBe('X');
  });

  it('a block can hold blocks: MUX 4:1 saved as a block and used again', () => {
    const inner = mux4(0);
    const r = blockFromSelection(inner, inner.components.map((c) => c.id), 'MUX4');
    if (!r.ok) throw new Error(r.error);
    expect(r.block.inputs).toEqual(['I0', 'I1', 'I2', 'I3', 'S0', 'S1']);
    for (const m of [0b100100, 0b010010, 0b110001, 0b111000]) {
      const sel = ((m >> 4) & 1) | (((m >> 5) & 1) << 1);
      const c: Circuit = {
        version: 1,
        name: 'nested',
        timeUnit: 'ns',
        blocks: [...inner.blocks!, r.block],
        components: [
          ...['I0', 'I1', 'I2', 'I3', 'S0', 'S1'].map((id, i) =>
            createComponent('INPUT', `x${id}`, { x: 0, y: 60 * i }, { props: { value: ((m >> i) & 1) as 0 | 1 } }),
          ),
          blockInstance(r.block, 'M', { x: 200, y: 0 }),
        ],
        wires: ['I0', 'I1', 'I2', 'I3', 'S0', 'S1'].map((p, i) => createWire(`w${i}`, [`x${p}`, 'out'], ['M', p])),
      };
      expect(flattenBlocks(c).circuit.components.some((x) => x.type === 'BLOCK')).toBe(false);
      expect(new Simulator(c).value('M:F')).toBe((m >> sel) & 1);
    }
  });

  it('the critical path goes through the gates inside, shown as the blocks', () => {
    const r = criticalPaths(mux4(0));
    if (!r.ok) throw new Error(r.reason);
    // S0 → inverter, AND, OR in B1 (3 Tp) → AND, OR in B3 (2 Tp)
    expect(r.paths[0]).toMatchObject({ end: 'F', delay: 50, levels: 5 });
    // through B1 or B2, which are as long: shown as the blocks, not their gates
    expect(r.paths[0].components).toHaveLength(3);
    expect(r.paths[0].components[0]).toBe('S0');
    expect(r.paths[0].components[2]).toBe('B3');
  });

  it('can be taken apart into its parts, each with its own Tp', () => {
    const c = mux4(0b010110);
    const r = expandComponent(c, 'B3')!;
    expect(r.parts.sort()).toEqual(['B3_a1', 'B3_a2', 'B3_n1', 'B3_o1']);
    expect(r.circuit.components.find((x) => x.id === 'B3_n1')!.delay).toBe(1);
    expect(new Simulator(r.circuit).value('B3_o1:out')).toBe(new Simulator(c).value('B3:F'));
  });

  it('travels with the circuit in a saved file, and a missing definition is an error', () => {
    const c = mux4(5);
    const back = parseCircuit(serializeCircuit(c));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.circuit.blocks).toEqual(c.blocks);
    const broken = { ...c, blocks: [] };
    expect(validateCircuit(broken).some((i) => i.severity === 'error' && i.componentId === 'B1')).toBe(true);
  });
});
