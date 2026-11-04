import { describe, expect, it } from 'vitest';
import { hasErrors, validateCircuit } from '../model';
import { parseFunction } from './expression';
import type { ParsedFunction } from './expression';
import { circuitFromFunction } from './fromFunction';
import type { BuildMode } from './fromFunction';
import { truthTable, variablesOf } from './func';
import { analyse } from './hazards';

const parsed = (text: string): ParsedFunction => {
  const r = parseFunction(text);
  if (!r.ok) throw new Error(r.error);
  return r.fn;
};
const ones = (fn: ParsedFunction) => fn.table.flatMap((v, m) => (v === 1 ? [m] : []));
const lampNet = (c: ReturnType<typeof circuitFromFunction>) => {
  const lamp = c.components.find((x) => x.type === 'OUTPUT')!;
  const w = c.wires.find((x) => x.to.component === lamp.id)!;
  return `${w.from.component}:${w.from.port}`;
};

describe('reading a function', () => {
  it("F = X0X1 + X1'X2 is Σ(3,4,5,7) of X2X1X0 (WK5)", () => {
    const fn = parsed("F = X0X1 + X1'X2");
    expect(fn.vars).toEqual(['X2', 'X1', 'X0']);
    expect(ones(fn)).toEqual([3, 4, 5, 7]);
  });

  it('juxtaposition, parentheses, primes, XOR and constants', () => {
    expect(ones(parsed("f = (A' + B)(B' + C)"))).toEqual([0, 1, 3, 7]);
    expect(ones(parsed('Z = AB ⊕ CD'))).toEqual([3, 7, 11, 12, 13, 14]);
    expect(ones(parsed("G = (AB)' + 0"))).toEqual([0, 1, 2]);
    expect(ones(parsed('A·B*C & 1'))).toEqual([7]);
  });

  it('minterms, maxterms, ranges and don\'t cares', () => {
    const f = parsed('F(A,B,C,D) = Σ(0,1,4,6,8,9) + d(10–15)');
    expect(f.vars).toEqual(['A', 'B', 'C', 'D']);
    expect(f.table.filter((v) => v === 'd')).toHaveLength(6);
    expect(ones(parsed('F = Π(0, 2)'))).toEqual([1, 3]); // two variables
    expect(parsed('F = Σm(3,4,5,7)').vars).toEqual(['A', 'B', 'C']);
  });

  it('says what is wrong in Hebrew', () => {
    for (const bad of ['', 'F = A +', 'F = (A + B', 'F = A $ B', 'F = Σ(1, x)', 'F(A,B) = Σ(5)']) {
      const r = parseFunction(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/[א-ת]/);
    }
  });
});

describe('building a circuit from a function', () => {
  const modes: BuildMode[] = ['written', 'sop', 'pos', 'canonical'];

  it('every form computes the same function, and is a valid circuit', () => {
    for (const text of [
      "F = X0X1 + X1'X2",
      "f = (A' + B)(B' + C)",
      'Z = AB ⊕ CD',
      "G = ((AB)' + C)'D",
      'F(A,B,C,D) = Σ(2,3,4,5,10,11,15) + d(14)',
      'F = Σ(0,1,2,4,5,8,9,10)',
      'H = ABCDE + A\'B\'C\'D\'E\'', // fan-in 5: a tree
    ]) {
      const fn = parsed(text);
      for (const mode of modes) {
        const c = circuitFromFunction(fn, mode);
        const issues = validateCircuit(c);
        expect(hasErrors(issues)).toBe(false);
        expect(issues.filter((i) => i.code === 'UNCONNECTED_INPUT')).toEqual([]);
        expect(variablesOf(c).map((v) => v.id)).toEqual(fn.vars);
        const got = truthTable(c, lampNet(c));
        fn.table.forEach((v, m) => {
          if (v !== 'd') expect(got[m]).toBe(v);
        });
      }
    }
  });

  it("the WK5 example built as written has the static-1 hazard, and the analysis finds it", () => {
    const c = circuitFromFunction(parsed("F = X0X1 + X1'X2"), 'written');
    const result = analyse(c, lampNet(c))!;
    expect(result.structure.form).toBe('sop');
    expect(result.hazards).toHaveLength(1);
    expect(c.name).toBe("F = X0X1 + X1'X2");
  });

  it('no two components overlap', () => {
    const c = circuitFromFunction(parsed('F(A,B,C,D) = Σ(1,2,3,5,7,10,11,12,14)'), 'canonical');
    const boxes = c.components.map((x) => ({ x: x.position.x, y: x.position.y, id: x.id }));
    for (const a of boxes)
      for (const b of boxes)
        if (a !== b && a.x === b.x) expect(Math.abs(a.y - b.y) >= 48).toBe(true);
  });
});
