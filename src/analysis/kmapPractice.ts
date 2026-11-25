/**
 * Karnaugh map practice with feedback (supervisor's review, 25.11): fill the
 * map of a given function, then circle groups, and get told what is wrong
 * the way a TA would: a cell in the wrong place, a group that is not a
 * rectangle of 1, 2, 4 or 8, a group with a 0 in it, a 1 left out, a group
 * that could be bigger, one that is not needed, or a cover that is right but
 * not minimal (WK4).
 *
 * Variables are MSB first, as everywhere in the analysis: with A, B, C, D the
 * minterm number is ABCD in binary. The map is drawn with the first half of
 * the variables on the rows and the rest on the columns, both in Gray order.
 */
import { rng } from '../exercises/exercises';
import { minterms, product, sum } from './format';
import type { Cube } from './func';
import { minimalPos, minimalSop } from './minimize';
import type { Value } from './minimize';

export type Target = 'sop' | 'pos';

export interface KQuestion {
  vars: string[];
  table: Value[];
}

export const GRAY = [[0], [0, 1], [0, 1, 3, 2]] as const;

/** Minterm numbers in map order: one row of the map after another. */
export function mapLayout(n: number): { rows: readonly number[]; cols: readonly number[]; at: (ri: number, ci: number) => number } {
  const r = Math.floor(n / 2);
  const rows = GRAY[r];
  const cols = GRAY[n - r];
  return { rows, cols, at: (ri, ci) => (rows[ri] << (n - r)) | cols[ci] };
}

/** "F(A,B,C) = Σm(1, 3, 5) + d(6)" */
export function describeQuestion(q: KQuestion): string {
  const ones = q.table.flatMap((v, m) => (v === 1 ? [m] : []));
  const dc = q.table.flatMap((v, m) => (v === 'd' ? [m] : []));
  return `F(${q.vars.join(',')}) = ${minterms(ones)}${dc.length ? ` + d(${dc.join(', ')})` : ''}`;
}

/**
 * A random function to practise on: 3 or 4 variables, not constant, using
 * every variable, with some don't cares when asked.
 */
export function randomQuestion(seed: number, n: 3 | 4, dontCares: number): KQuestion {
  const next = rng(seed);
  const vars = ['A', 'B', 'C', 'D'].slice(0, n);
  for (;;) {
    const table: Value[] = Array.from({ length: 1 << n }, () => (next() < 0.45 ? 1 : 0));
    for (let i = 0; i < dontCares; i++) table[Math.floor(next() * table.length)] = 'd';
    const ones = table.filter((v) => v === 1).length;
    const zeros = table.filter((v) => v === 0).length;
    // something to group on both sides, and at least two terms in the answer
    if (ones < 2 || zeros < 2 || minimalSop(table, n).length < 2) continue;
    const uses = (k: number) => {
      const mask = 1 << (n - 1 - k);
      return table.some((v, m) => v !== 'd' && table[m ^ mask] !== 'd' && v !== table[m ^ mask]);
    };
    if (vars.every((_, k) => uses(k))) return { vars, table };
  }
}

/** The cells filled wrongly (an empty cell counts as wrong). */
export function wrongCells(table: readonly Value[], guess: readonly (Value | null)[]): number[] {
  return table.flatMap((v, m) => (guess[m] === v ? [] : [m]));
}

/**
 * The cube a set of cells makes, or null when they are not one: the cells
 * must be exactly every cell that agrees on the variables they all share,
 * which on the map is a rectangle of 1, 2, 4, 8 or 16 cells (across the edges too).
 */
export function cubeOf(cells: readonly number[], n: number): Cube | null {
  const set = [...new Set(cells)];
  if (set.length === 0) return null;
  const cube: Cube = new Map();
  for (let k = 0; k < n; k++) {
    const b = (set[0] >> (n - 1 - k)) & 1;
    if (set.every((m) => ((m >> (n - 1 - k)) & 1) === b)) cube.set(k, b as 0 | 1);
  }
  return set.length === 1 << (n - cube.size) ? cube : null;
}

/** The cells of a cube. */
export function cellsOf(cube: Cube, n: number): number[] {
  return Array.from({ length: 1 << n }, (_, m) => m).filter((m) =>
    [...cube].every(([k, b]) => ((m >> (n - 1 - k)) & 1) === b),
  );
}

/** The term of a group: a product of the 1s it covers, or a sum for the 0s. */
export function termOf(vars: string[], cube: Cube, target: Target): string {
  if (target === 'sop') return product(vars, cube);
  // a group of zeros where x = 0 and y = 1 is the sum (x + y')
  const flipped: Cube = new Map([...cube].map(([k, b]) => [k, (1 - b) as 0 | 1]));
  return cube.size > 1 ? `(${sum(vars, flipped)})` : sum(vars, flipped);
}

/** The whole expression from the terms. */
export function expressionOf(vars: string[], cubes: Cube[], target: Target): string {
  if (cubes.length === 0) return target === 'sop' ? '0' : '1';
  const terms = cubes.map((c) => termOf(vars, c, target));
  return target === 'sop' ? terms.join(' + ') : terms.join('');
}

const goal = (target: Target): 0 | 1 => (target === 'sop' ? 1 : 0);
const literals = (cubes: Cube[]) => cubes.reduce((s, c) => s + c.size, 0);

/** A bigger group that contains this one, when there is one (so it is not prime). */
export function bigger(table: readonly Value[], n: number, cube: Cube, target: Target): Cube | null {
  const g = goal(target);
  let best: Cube | null = null;
  let current = cube;
  for (;;) {
    let grown: Cube | null = null;
    for (const k of current.keys()) {
      const c = new Map(current);
      c.delete(k);
      if (cellsOf(c, n).every((m) => table[m] === g || table[m] === 'd')) {
        grown = c;
        break;
      }
    }
    if (!grown) return best;
    best = grown;
    current = grown;
  }
}

export type GroupProblem = 'shape' | 'wrong-value' | 'only-dc';

/** Why a group cannot be used, or null when it can. */
export function groupProblem(table: readonly Value[], n: number, cells: readonly number[], target: Target): GroupProblem | null {
  const cube = cubeOf(cells, n);
  if (!cube) return 'shape';
  const g = goal(target);
  if (cells.some((m) => table[m] !== g && table[m] !== 'd')) return 'wrong-value';
  if (cells.every((m) => table[m] === 'd')) return 'only-dc';
  return null;
}

export interface CoverFeedback {
  /** Cells of the goal value (1 for SOP, 0 for POS) that no group covers. */
  uncovered: number[];
  /** Groups (by index) that could be bigger, with the bigger term. */
  notPrime: { index: number; better: string }[];
  /** Groups (by index) whose cells other groups already cover. */
  redundant: number[];
  /** Size of a minimal answer, and of this one. */
  minimal: { terms: number; literals: number; expression: string };
  mine: { terms: number; literals: number; expression: string };
  /** A cover with as few terms and literals as the minimal one. */
  done: boolean;
}

export function checkCover(q: KQuestion, groups: readonly Cube[], target: Target): CoverFeedback {
  const n = q.vars.length;
  const g = goal(target);
  const targets = q.table.flatMap((v, m) => (v === g ? [m] : []));
  const cells = groups.map((c) => new Set(cellsOf(c, n)));
  const uncovered = targets.filter((m) => !cells.some((s) => s.has(m)));
  const notPrime = groups.flatMap((c, index) => {
    const b = bigger(q.table, n, c, target);
    return b ? [{ index, better: termOf(q.vars, b, target) }] : [];
  });
  const redundant = groups.flatMap((_, i) => {
    const mine = targets.filter((m) => cells[i].has(m));
    return mine.every((m) => cells.some((s, j) => j !== i && s.has(m))) ? [i] : [];
  });
  const best = target === 'sop' ? minimalSop(q.table, n) : minimalPos(q.table, n);
  const minimal = { terms: best.length, literals: literals(best), expression: expressionOf(q.vars, best, target) };
  const mine = { terms: groups.length, literals: literals([...groups]), expression: expressionOf(q.vars, [...groups], target) };
  const done =
    uncovered.length === 0 &&
    redundant.length === 0 &&
    mine.terms === minimal.terms &&
    mine.literals === minimal.literals;
  return { uncovered, notPrime, redundant, minimal, mine, done };
}

/** The groups of a minimal answer. */
export const minimalGroups = (q: KQuestion, target: Target): Cube[] =>
  target === 'sop' ? minimalSop(q.table, q.vars.length) : minimalPos(q.table, q.vars.length);
