import { describe, expect, it } from 'vitest';
import { cubeOf } from './kmapPractice';
import { checkPla, minimalPla, minimalPlaTerms, productText, readFunctions, romSize, wrongRomCells } from './romPla';
import type { FunctionSet, PlaTerm } from './romPla';

const set = (text: string): FunctionSet => {
  const r = readFunctions(text);
  if (!r.ok) throw new Error(r.error);
  return r.set;
};

describe('ROM and PLA (WK11A)', () => {
  it('a ROM is the truth table: f and g of the lecture in an 8×2 ROM', () => {
    const s = set('f(a,b,c) = Σ(0,2,4,6,7)\ng(a,b,c) = Σ(0,1,2,3,4,5)');
    expect(romSize(s)).toEqual({ words: 8, bits: 2 });
    const burnt = Array.from({ length: 8 }, (_, m) => s.fns.map((f) => f.table[m] === 1));
    expect(wrongRomCells(s, burnt)).toEqual([]);
    burnt[7][1] = true;
    expect(wrongRomCells(s, burnt)).toEqual(['7:1']);
  });

  it('keeps the declared order of numbered inputs (A1 A0 B1 B0), and refuses too many', () => {
    const s = set('S1(A1,A0,B1,B0) = Σ(2,3,6,7)\nS0(A1,A0,B1,B0) = Σ(1,3)');
    expect(s.vars).toEqual(['A1', 'A0', 'B1', 'B0']);
    expect(readFunctions('f = ABCDE').ok).toBe(false);
    expect(readFunctions('f = A\nf = B').ok).toBe(false);
  });

  it('finds the p of the course solutions', () => {
    // full adder: S needs its 4 minterms, Cout = AB + AC + BC, so p = 7
    expect(minimalPla(set('S = A ⊕ B ⊕ C\nCout = AB + AC + BC'))).toHaveLength(7);
    // lecture 2023A: f = cb' + ab, g = a'b'cd: p = 3
    expect(minimalPla(set("f(a,b,c,d) = cb' + ab\ng(a,b,c,d) = a'b'cd"))).toHaveLength(3);
    // 2024B: f2 = C', h = A' + C': p = 2
    expect(minimalPla(set("f2 = C'\nh = A' + C'"))).toHaveLength(2);
    // 2022B: Out3 = S1', Out2 = Out1 = S0, Out0 = 1: p = 3 (S1', S0 and the constant 1)
    const s22 = set("Out3(S1,S0) = S1'\nOut2(S1,S0) = S0\nOut1(S1,S0) = S0\nOut0(S1,S0) = 1");
    expect(minimalPla(s22).map((c) => productText(s22, c)).sort()).toEqual(['1', 'S0', "S1'"]);
  });

  it('shares a product even when it is not minimal for one function', () => {
    // g = ABC needs its own product; f = AB + A'C cannot do with ABC instead of AB, so p = 3
    const s = set("f = AB + A'C\ng = ABC");
    expect(minimalPla(s)).toHaveLength(3);
  });

  it('checks a PLA the student programmed', () => {
    const s = set("f(a,b,c,d) = cb' + ab\ng(a,b,c,d) = a'b'cd");
    const cube = (cells: number[]) => cubeOf(cells, 4)!;
    const good = minimalPlaTerms(s);
    expect(checkPla(s, good).done).toBe(true);
    // a'b'cd is also an implicant of f, but f does not need it: it goes to g only
    expect(good.map((t) => `${productText(s, t.cube)}:${t.outs.map(Number).join('')}`).sort()).toEqual([
      "a'·b'·c·d:01",
      'a·b:10',
      "b'·c:10",
    ]);

    // f without ab: wrong in row 12 (a = b = 1, c = d = 0)
    const t: PlaTerm[] = [
      { cube: cube([2, 3, 10, 11]), outs: [true, false] }, // b'c
      { cube: cube([3]), outs: [false, true] }, // a'b'cd
    ];
    const f = checkPla(s, t);
    expect(f.outputs[0]).toEqual({ m: 12, got: 0, want: 1 });
    expect(f.outputs[1]).toBeNull();

    // an unused product and a duplicate
    const extra = checkPla(s, [...good, { cube: cube([0]), outs: [false, false] }, { ...good[0] }]);
    expect(extra.unused).toEqual([good.length]);
    expect(extra.duplicate).toEqual([good.length + 1]);
    expect(extra.done).toBe(false);
  });
});
