import { describe, expect, it } from 'vitest';
import type { Cube } from './func';
import type { Value } from './minimize';
import {
  checkCover,
  cubeOf,
  describeQuestion,
  groupProblem,
  mapLayout,
  minimalGroups,
  randomQuestion,
  termOf,
  wrongCells,
} from './kmapPractice';
import type { KQuestion } from './kmapPractice';

const tableOf = (n: number, ones: number[], dc: number[] = []): Value[] =>
  Array.from({ length: 1 << n }, (_, m) => (dc.includes(m) ? 'd' : ones.includes(m) ? 1 : 0));
const cube = (cells: number[], n: number): Cube => {
  const c = cubeOf(cells, n);
  if (!c) throw new Error(`not a group: ${cells}`);
  return c;
};

// WK4: F(A,B,C,D) = Σm(0, 2, 5, 7, 8, 10, 13, 15) = B'D' + BD
const wk4: KQuestion = { vars: ['A', 'B', 'C', 'D'], table: tableOf(4, [0, 2, 5, 7, 8, 10, 13, 15]) };

describe('Karnaugh map practice', () => {
  it('lays the map out in Gray order, rows AB and columns CD', () => {
    const { rows, cols, at } = mapLayout(4);
    expect(rows).toEqual([0, 1, 3, 2]);
    expect(cols).toEqual([0, 1, 3, 2]);
    // row AB = 11, column CD = 10 is minterm 14
    expect(at(2, 3)).toBe(14);
    expect(mapLayout(3).at(1, 2)).toBe(7); // A = 1, BC = 11
  });

  it('marks the cells filled wrongly', () => {
    const guess: (Value | null)[] = [...wk4.table];
    guess[3] = 1; // 2 and 3 swapped: the Gray order trap
    guess[2] = 0;
    guess[12] = null;
    expect(wrongCells(wk4.table, guess)).toEqual([2, 3, 12]); // an empty cell is not done yet
    expect(wrongCells(wk4.table, guess.map((v, m) => (m === 12 ? 0 : v)))).toEqual([2, 3]);
  });

  it('accepts rectangles of 1, 2, 4, 8 cells, also across the edges', () => {
    // the four corners: B'D'
    expect(termOf(wk4.vars, cube([0, 2, 8, 10], 4), 'sop')).toBe("B'·D'");
    expect(termOf(wk4.vars, cube([5, 7, 13, 15], 4), 'sop')).toBe('B·D');
    expect(cubeOf([0, 1, 2], 4)).toBeNull(); // 3 cells
    expect(cubeOf([0, 5], 4)).toBeNull(); // diagonal
    expect(cubeOf([0, 1, 4, 6], 4)).toBeNull(); // 4 cells, not a rectangle
    expect(groupProblem(wk4.table, 4, [0, 1], 'sop')).toBe('wrong-value');
    expect(groupProblem(wk4.table, 4, [0, 1, 2], 'sop')).toBe('shape');
    expect(groupProblem(wk4.table, 4, [0, 2], 'sop')).toBeNull();
  });

  it('accepts the minimal cover and explains what is missing or too much', () => {
    const corners = cube([0, 2, 8, 10], 4);
    const middle = cube([5, 7, 13, 15], 4);
    expect(checkCover(wk4, [corners, middle], 'sop').done).toBe(true);

    const half = checkCover(wk4, [corners], 'sop');
    expect(half.done).toBe(false);
    expect(half.uncovered).toEqual([5, 7, 13, 15]);

    // a pair inside the corners could be the whole corner group
    const small = checkCover(wk4, [cube([0, 2], 4), cube([8, 10], 4), middle], 'sop');
    expect(small.uncovered).toEqual([]);
    expect(small.notPrime.map((p) => p.better)).toEqual(["B'·D'", "B'·D'"]);
    expect(small.done).toBe(false);
    expect(small.minimal.terms).toBe(2);

    // an extra group that the others already cover
    const extra = checkCover(wk4, [corners, middle, cube([5, 13], 4)], 'sop');
    expect(extra.redundant).toEqual([2]);
    expect(extra.done).toBe(false);
  });

  it('takes a don’t care into a group, but not a group of don’t cares alone', () => {
    // F(A,B,C) = Σm(1, 3) + d(5, 7) = C
    const q: KQuestion = { vars: ['A', 'B', 'C'], table: tableOf(3, [1, 3], [5, 7]) };
    expect(checkCover(q, [cube([1, 3, 5, 7], 3)], 'sop').done).toBe(true);
    expect(termOf(q.vars, cube([1, 3, 5, 7], 3), 'sop')).toBe('C');
    expect(groupProblem(q.table, 3, [5, 7], 'sop')).toBe('only-dc');
  });

  it('groups the zeros for a product of sums', () => {
    // F = Σm(1, 3, 5, 6, 7): the zeros are 0, 2 and 4
    const q: KQuestion = { vars: ['A', 'B', 'C'], table: tableOf(3, [1, 3, 5, 6, 7]) };
    expect(termOf(q.vars, cube([0, 2], 3), 'pos')).toBe('(A + C)');
    expect(groupProblem(q.table, 3, [0, 1], 'pos')).toBe('wrong-value');
    const ok = checkCover(q, [cube([0, 2], 3), cube([0, 4], 3)], 'pos');
    expect(ok.done).toBe(true);
    expect(ok.mine.expression).toBe('(A + C)(B + C)');
    expect(minimalGroups(q, 'pos')).toHaveLength(2);
  });

  it('makes random questions that need at least two groups, the same for the same seed', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const n = seed % 2 ? 3 : 4;
      const q = randomQuestion(seed, n, seed % 3 === 0 ? 2 : 0);
      expect(q.vars).toHaveLength(n);
      expect(minimalGroups(q, 'sop').length).toBeGreaterThanOrEqual(2);
      // the minimal answer passes its own check
      expect(checkCover(q, minimalGroups(q, 'sop'), 'sop').done).toBe(true);
      expect(checkCover(q, minimalGroups(q, 'pos'), 'pos').done).toBe(true);
      expect(describeQuestion(q)).toBe(describeQuestion(randomQuestion(seed, n, seed % 3 === 0 ? 2 : 0)));
    }
  });
});
