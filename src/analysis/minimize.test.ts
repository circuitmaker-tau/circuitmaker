import { describe, expect, it } from 'vitest';
import type { Cube } from './func';
import { product } from './format';
import { minimalPos, minimalSop } from './minimize';
import type { Value } from './minimize';

const ABCD = ['A', 'B', 'C', 'D'];
/** A truth table from minterms and don't cares (A is the MSB). */
const table = (n: number, ones: number[], dc: number[] = []): Value[] =>
  Array.from({ length: 1 << n }, (_, m) => (ones.includes(m) ? 1 : dc.includes(m) ? 'd' : 0));
const terms = (cubes: Cube[], vars = ABCD) => cubes.map((c) => product(vars, c)).sort();
/** The function the cubes compute. */
const evalSop = (cubes: Cube[], n: number, m: number) =>
  cubes.some((c) => [...c].every(([k, v]) => ((m >> (n - 1 - k)) & 1) === v)) ? 1 : 0;

describe('minimal sum of products (TEST_CIRCUITS B2)', () => {
  it('WK5: F = Σ(3,4,5,7) of X2X1X0 is X0X1 + X1\'X2', () => {
    expect(terms(minimalSop(table(3, [3, 4, 5, 7]), 3), ['X2', 'X1', 'X0'])).toEqual(
      ["X2·X1'", 'X1·X0'].sort(),
    );
  });

  it("B2.2 (2026A 1B): Σ(2,3,4,5,10,11,15) + d(14) = A'BC' + B'C + AC", () => {
    expect(terms(minimalSop(table(4, [2, 3, 4, 5, 10, 11, 15], [14]), 4))).toEqual(
      ["A'·B·C'", "B'·C", 'A·C'].sort(),
    );
  });

  it("B2.6 (2026C 1B): Σ(1,2,3,5,7,10,11,12,14) = B'C + A'D + ABD'", () => {
    expect(terms(minimalSop(table(4, [1, 2, 3, 5, 7, 10, 11, 12, 14]), 4))).toEqual(
      ["B'·C", "A'·D", "A·B·D'"].sort(),
    );
  });

  it("B2.14 (homework 4): Σ(0,1,4,6,8,9) + d(10–15) = B'C' + BD'", () => {
    const dc = [10, 11, 12, 13, 14, 15];
    expect(terms(minimalSop(table(4, [0, 1, 4, 6, 8, 9], dc), 4))).toEqual(["B'·C'", "B·D'"].sort());
  });

  it('constants, and every cover computes the function', () => {
    expect(minimalSop(table(3, []), 3)).toEqual([]);
    expect(terms(minimalSop(table(2, [0, 1, 2, 3]), 2))).toEqual(['1']);
    // random functions of 4 to 6 variables, with don't cares: the cover is exact on the 1s and 0s
    let seed = 7;
    const r = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 40; t++) {
      const n = 4 + (t % 3);
      const f: Value[] = Array.from({ length: 1 << n }, () => (r() < 0.4 ? 1 : r() < 0.15 ? 'd' : 0));
      const cubes = minimalSop(f, n);
      f.forEach((v, m) => {
        if (v !== 'd') expect(evalSop(cubes, n, m)).toBe(v);
      });
    }
  });

  it("minimal product of sums: (A' + B)(B' + C) for homework 5's Z", () => {
    // Z = (A' + B)(B' + C): zero when A = 1, B = 0, or when B = 1, C = 0
    const ones = [0, 1, 3, 7].map((m) => m); // A'B'C', A'B'C, A'BC, ABC
    const zeros = minimalPos(table(3, ones), 3);
    const sums = zeros.map((c) => [...c].map(([k, v]) => (v === 0 ? 'ABC'[k] : `${'ABC'[k]}'`)).join(' + '));
    expect(sums.sort()).toEqual(["A' + B", "B' + C"].sort());
  });
});
