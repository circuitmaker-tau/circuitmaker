/**
 * ROM and PLA (WK11A): several functions of the same inputs, put in a ROM
 * (a fixed decoder of every minterm and a programmed OR array, so the truth
 * table itself) or in a PLA (programmed AND plane of p products, shared by
 * the outputs, and a programmed OR plane). The aim in a PLA is a small p, by
 * sharing products between the functions, even when that means a function
 * is not written in its own minimal form (course summary, WK11A).
 */
import { MAX_FUNCTION_VARS, orderVariables, parseFunction } from './expression';
import type { ParsedFunction } from './expression';
import { lift } from './equivalence';
import { product } from './format';
import type { Cube } from './func';
import { cellsOf } from './kmapPractice';
import type { Value } from './minimize';
import { tr } from '../i18n/lang';

export const MAX_ROM_VARS = 4;
export const MAX_ROM_OUTPUTS = 4;

export interface FunctionSet {
  vars: string[];
  fns: ParsedFunction[];
}

export type FunctionSetResult = { ok: true; set: FunctionSet } | { ok: false; error: string };

/** One function per line (or separated by ;), all put on the same variables. */
export function readFunctions(text: string): FunctionSetResult {
  const lines = text
    .split(/[\n;]/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: tr('כותבים פונקציה אחת או יותר, אחת בכל שורה.', 'Write one function or more, one per line.') };
  if (lines.length > MAX_ROM_OUTPUTS) return { ok: false, error: tr(`אפשר עד ${MAX_ROM_OUTPUTS} פונקציות.`, `Up to ${MAX_ROM_OUTPUTS} functions.`) };
  const fns: ParsedFunction[] = [];
  for (const [i, line] of lines.entries()) {
    const r = parseFunction(line);
    if (!r.ok) return { ok: false, error: tr(`שורה ${i + 1}: ${r.error}`, `Line ${i + 1}: ${r.error}`) };
    fns.push(r.fn);
  }
  const names = fns.map((f) => f.name);
  const twice = names.find((n, i) => names.indexOf(n) !== i);
  if (twice) return { ok: false, error: tr(`השם ${twice} מופיע פעמיים. לכל פונקציה שם משלה (למשל f ו-g).`, `The name ${twice} appears twice. Each function needs its own name (e.g. f and g).`) };
  // the same declared variables everywhere keep their order (A1 A0 B1 B0); otherwise the usual order
  const same = fns.every((f) => f.vars.join() === fns[0].vars.join());
  const vars = same ? fns[0].vars : orderVariables(fns.flatMap((f) => f.vars));
  const limit = Math.min(MAX_ROM_VARS, MAX_FUNCTION_VARS);
  if (vars.length > limit) {
    return { ok: false, error: tr(`יחד יש ${vars.length} משתנים (${vars.join(', ')}). כאן אפשר עד ${limit}.`, `Together there are ${vars.length} variables (${vars.join(', ')}). Up to ${limit} here.`) };
  }
  return { ok: true, set: { vars, fns: fns.map((f) => lift(f, vars)) } };
}

/** Bits of row m, MSB first. */
export const rowBits = (m: number, n: number) =>
  Array.from({ length: n }, (_, k) => (m >> (n - 1 - k)) & 1);

// ------------------------------------------------------------------ ROM

/** The ROM's size: 2^n words of m bits. */
export const romSize = (set: FunctionSet) => ({ words: 1 << set.vars.length, bits: set.fns.length });

/** Cells of the OR array burnt wrongly (rows where the function is d accept both). */
export function wrongRomCells(set: FunctionSet, burnt: readonly (readonly boolean[])[]): string[] {
  const out: string[] = [];
  for (let m = 0; m < 1 << set.vars.length; m++) {
    set.fns.forEach((f, j) => {
      const v: Value = f.table[m];
      if (v !== 'd' && (v === 1) !== (burnt[m]?.[j] ?? false)) out.push(`${m}:${j}`);
    });
  }
  return out;
}

// ------------------------------------------------------------------ PLA

const isImplicant = (f: ParsedFunction, n: number, cube: Cube) =>
  cellsOf(cube, n).every((m) => f.table[m] !== 0);

/** Every cube on n variables (3^n of them): each variable fixed to 0, to 1, or left out. */
function allCubes(n: number): Cube[] {
  const out: Cube[] = [];
  for (let code = 0; code < 3 ** n; code++) {
    const cube: Cube = new Map();
    let c = code;
    for (let k = 0; k < n; k++) {
      const t = c % 3;
      c = Math.floor(c / 3);
      if (t > 0) cube.set(k, (t - 1) as 0 | 1);
    }
    out.push(cube);
  }
  return out;
}

/**
 * The fewest products that a PLA needs for these functions: a set of cubes such
 * that every 1 of every function is covered by a cube that is an implicant of
 * that function. Exact search (branch on the 1 with the fewest choices), which
 * is quick for the sizes of the course (up to 4 variables and 4 functions).
 */
export function minimalPla(set: FunctionSet): Cube[] {
  const n = set.vars.length;
  const cubes = allCubes(n);
  const cells = cubes.map((c) => cellsOf(c, n));
  // implicant[j][i]: cube i may feed function j
  const implicant = set.fns.map((f) => cubes.map((c) => isImplicant(f, n, c)));
  const ones = set.fns.flatMap((f, j) => f.table.flatMap((v, m) => (v === 1 ? [[j, m] as const] : [])));
  // candidates for each 1: the implicants of its function that cover it, biggest first
  const choices = ones.map(([j, m]) =>
    cubes
      .map((_, i) => i)
      .filter((i) => implicant[j][i] && cells[i].includes(m))
      .sort((a, b) => cubes[a].size - cubes[b].size),
  );
  let best: number[] | null = null;
  const chosen: number[] = [];
  const covered = (k: number) => choices[k].some((i) => chosen.includes(i));
  const search = () => {
    if (best && chosen.length >= best.length) return;
    let pick = -1;
    for (let k = 0; k < ones.length; k++) {
      if (covered(k)) continue;
      if (pick < 0 || choices[k].length < choices[pick].length) pick = k;
    }
    if (pick < 0) {
      best = [...chosen];
      return;
    }
    if (best && chosen.length + 1 >= best.length) return;
    for (const i of choices[pick]) {
      chosen.push(i);
      search();
      chosen.pop();
    }
  };
  search();
  return (best ?? []).map((i) => cubes[i]);
}

export interface PlaTerm {
  cube: Cube;
  /** Which functions this product feeds (the OR plane). */
  outs: boolean[];
}

export interface PlaFeedback {
  /** For each function: null when right, or a row where it is wrong. */
  outputs: ({ m: number; got: 0 | 1; want: 0 | 1 } | null)[];
  /** Products not connected to any output. */
  unused: number[];
  /** Products equal to an earlier one. */
  duplicate: number[];
  p: number;
  minimalP: number;
  done: boolean;
}

export function checkPla(set: FunctionSet, terms: readonly PlaTerm[]): PlaFeedback {
  const n = set.vars.length;
  const cells = terms.map((t) => new Set(cellsOf(t.cube, n)));
  const outputs = set.fns.map((f, j) => {
    for (let m = 0; m < 1 << n; m++) {
      const want = f.table[m];
      if (want === 'd') continue;
      const got: 0 | 1 = terms.some((t, i) => t.outs[j] && cells[i].has(m)) ? 1 : 0;
      if (got !== want) return { m, got, want };
    }
    return null;
  });
  const key = (c: Cube) => [...c].sort((a, b) => a[0] - b[0]).join(';');
  const unused = terms.flatMap((t, i) => (t.outs.some(Boolean) ? [] : [i]));
  const duplicate = terms.flatMap((t, i) => (terms.slice(0, i).some((u) => key(u.cube) === key(t.cube)) ? [i] : []));
  const minimalP = minimalPla(set).length;
  const p = terms.length;
  const done = outputs.every((o) => o === null) && unused.length === 0 && duplicate.length === 0 && p <= minimalP;
  return { outputs, unused, duplicate, p, minimalP, done };
}

/**
 * The products of a minimal PLA, each connected to the functions that need it:
 * a product goes to every function it is an implicant of, and then, smallest
 * first, a connection whose 1s the other connections already cover is dropped.
 */
export function minimalPlaTerms(set: FunctionSet): PlaTerm[] {
  const n = set.vars.length;
  const cubes = minimalPla(set);
  const cells = cubes.map((c) => cellsOf(c, n));
  const outs = cubes.map((c) => set.fns.map((f) => isImplicant(f, n, c)));
  set.fns.forEach((f, j) => {
    const order = cubes.map((_, i) => i).sort((a, b) => cells[a].length - cells[b].length);
    for (const i of order) {
      if (!outs[i][j]) continue;
      const ones = cells[i].filter((m) => f.table[m] === 1);
      const others = (m: number) => cubes.some((_, o) => o !== i && outs[o][j] && cells[o].includes(m));
      if (ones.every(others)) outs[i][j] = false;
    }
  });
  return cubes.map((cube, i) => ({ cube, outs: outs[i] }));
}

/** "a·b'" for a product (1 for the empty product). */
export const productText = (set: FunctionSet, cube: Cube) => product(set.vars, cube);
