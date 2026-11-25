import { describe, expect, it } from 'vitest';
import { rng } from '../exercises/exercises';
import { hasErrors, validateCircuit } from '../model';
import type { Circuit, ComponentType } from '../model';
import { settle } from '../engine/settle';
import { withInputs } from './func';
import { buildRequest, METHODS, PRESETS, verifyRequest } from './request';
import type { Method } from './request';
import { readFunctions } from './romPla';
import type { FunctionSet } from './romPla';

const set = (text: string): FunctionSet => {
  const r = readFunctions(text);
  if (!r.ok) throw new Error(r.error);
  return r.set;
};

const ALLOWED: Record<Method, ComponentType[]> = {
  sop: ['AND', 'OR', 'NOT'],
  pos: ['AND', 'OR', 'NOT'],
  nand: ['NAND'],
  nor: ['NOR'],
  mux: ['MUX2', 'MUX4', 'MUX8', 'NOT'],
  mux2: ['MUX2'],
  decoder: ['DEC2x4', 'DEC3x8', 'OR'],
};
const GATES: ComponentType[] = ['AND', 'OR', 'NAND', 'NOR'];

/** The circuit computes every function (don't cares aside), with only the allowed parts and fan-in. */
function expectBuilds(s: FunctionSet, method: Method, fanIn: number): Circuit {
  const r = buildRequest(s, method, fanIn);
  if (!r.ok) throw new Error(r.error);
  const c = r.circuit;
  expect(hasErrors(validateCircuit(c))).toBe(false);
  // the switches in the order the functions were written (A1 A0 B1 B0 stays so)
  const switches = s.vars.map((v) => c.components.find((p) => p.id === v && p.type === 'INPUT')!);
  expect(switches.every(Boolean)).toBe(true);
  for (const p of c.components) {
    if (['INPUT', 'OUTPUT', 'CONST0', 'CONST1'].includes(p.type)) continue;
    expect(ALLOWED[method]).toContain(p.type);
    if (GATES.includes(p.type)) expect(p.inputs).toBeLessThanOrEqual(fanIn);
  }
  for (const f of s.fns) {
    const w = c.wires.find((x) => x.to.component === f.name)!;
    f.table.forEach((v, m) => {
      const got = settle(withInputs(c, switches, m)).nets.get(`${w.from.component}:${w.from.port}`);
      if (v !== 'd') expect(`${f.name}[${m}]=${got}`).toBe(`${f.name}[${m}]=${v}`);
    });
  }
  expect(verifyRequest(s, c)).toBe(true);
  return c;
}

const count = (c: Circuit, type: ComponentType) => c.components.filter((p) => p.type === type).length;

describe('a circuit from a request', () => {
  it('builds random functions in every way, right in every row, within the limits', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const next = rng(seed);
      const n = 2 + (seed % 3);
      const outs = 1 + (seed % 2);
      const vars = ['A', 'B', 'C', 'D'].slice(0, n).join(',');
      const lines = Array.from({ length: outs }, (_, j) => {
        const ones = Array.from({ length: 1 << n }, (_, m) => m).filter(() => next() < 0.5);
        return `F${j}(${vars}) = Σ(${ones.join(',')})`;
      });
      const s = set(lines.join('\n'));
      for (const m of METHODS) {
        if (m.id === 'decoder' && n > 3) continue;
        expectBuilds(s, m.id, 2 + (seed % 3));
      }
    }
  });

  it('the full adder in NAND only with fan-in 2: NAND-NAND, inverters from NAND', () => {
    const fa = set(PRESETS.find((p) => p.id === 'fa')!.text);
    const c = expectBuilds(fa, 'nand', 2);
    expect(count(c, 'NAND')).toBeGreaterThan(0);
    // Cout = AB + AC + BC shares nothing with S, and every gate has at most 2 inputs
    expectBuilds(fa, 'nor', 3);
    expectBuilds(fa, 'mux', 2);
  });

  it('a MUX with the last variable on its data inputs: one MUX 4:1 and one inverter at most', () => {
    const c = expectBuilds(set("f = AB'C + A'C' + BC"), 'mux', 4);
    expect(count(c, 'MUX4')).toBe(1);
    expect(count(c, 'NOT')).toBeLessThanOrEqual(1);
  });

  it('shares a product between outputs, and builds x\' from MUX 2:1 when only those are allowed', () => {
    const s = set('f = AB + C; g = AB');
    const c = expectBuilds(s, 'sop', 2);
    expect(count(c, 'AND')).toBe(1);
    const m = expectBuilds(set("f = A'"), 'mux2', 2);
    expect(count(m, 'MUX2')).toBe(1);
  });

  it('a decoder with OR gates, and what cannot be built that way', () => {
    const c = expectBuilds(set('f = Σ(1,2,4,7)'), 'decoder', 4);
    expect(count(c, 'DEC3x8')).toBe(1);
    expect(count(c, 'OR')).toBe(1);
    const four = buildRequest(set('f = ABCD'), 'decoder', 4);
    expect(four.ok).toBe(false);
    const clash = buildRequest(set('B = AB'), 'sop', 2);
    expect(clash.ok).toBe(false);
  });

  it('every preset builds', () => {
    for (const p of PRESETS) for (const m of METHODS) {
      const s = set(p.text);
      if (m.id === 'decoder' && (s.vars.length > 3 || s.vars.length < 2)) continue;
      expectBuilds(s, m.id, 2);
    }
  });
});
