/**
 * Minimal sum of products of a function of up to 6 variables (WK4: Karnaugh
 * maps, prime implicants, essential implicants, don't cares).
 *
 * With 6 variables there are only 3^6 = 729 cubes, so the prime implicants are
 * found by checking every cube, and the smallest cover by a short exact
 * search: essential primes first, then the fewest terms, then the fewest
 * literals. Ties go to the cover that comes first in a fixed order, so the
 * answer is always the same.
 */
import type { Cube } from './func';

export type Value = 0 | 1 | 'd';

/** A cube as (mask, bits): mask has a 1 for every variable the cube fixes. */
interface Implicant {
  mask: number;
  bits: number;
  covers: number[];
}

const popcount = (x: number) => {
  let n = 0;
  for (let v = x; v; v &= v - 1) n++;
  return n;
};

function primeImplicants(table: readonly Value[], n: number): Implicant[] {
  const full = (1 << n) - 1;
  const implicants: Implicant[] = [];
  for (let mask = 0; mask <= full; mask++) {
    for (let bits = mask; ; bits = (bits - 1) & mask) {
      // every minterm in the cube must be 1 or don't care, and at least one a real 1
      const covers: number[] = [];
      let ok = true;
      let hasOne = false;
      const free = full & ~mask;
      for (let sub = free; ; sub = (sub - 1) & free) {
        const m = bits | sub;
        if (table[m] === 0) {
          ok = false;
          break;
        }
        if (table[m] === 1) {
          hasOne = true;
          covers.push(m);
        }
        if (sub === 0) break;
      }
      if (ok && hasOne) implicants.push({ mask, bits, covers: covers.sort((a, b) => a - b) });
      if (bits === 0) break;
    }
  }
  // prime: no other implicant contains it (fewer fixed variables, agreeing on them)
  const contains = (big: Implicant, small: Implicant) =>
    big !== small &&
    (big.mask & small.mask) === big.mask &&
    (small.bits & big.mask) === big.bits &&
    big.mask !== small.mask;
  return implicants.filter((p) => !implicants.some((q) => contains(q, p)));
}

/** The cubes of a minimal sum of products; [] for the constant 0, one empty cube for the constant 1. */
export function minimalSop(table: readonly Value[], n: number): Cube[] {
  const ones = table.flatMap((v, m) => (v === 1 ? [m] : []));
  if (ones.length === 0) return [];
  if (table.every((v) => v !== 0)) return [new Map()];
  const primes = primeImplicants(table, n).sort(
    (a, b) => popcount(a.mask) - popcount(b.mask) || a.mask - b.mask || a.bits - b.bits,
  );

  // essential primes: the only prime that covers some 1
  const chosen = new Set<Implicant>();
  for (const m of ones) {
    const covering = primes.filter((p) => p.covers.includes(m));
    if (covering.length === 1) chosen.add(covering[0]);
  }
  const covered = new Set([...chosen].flatMap((p) => p.covers));
  const left = ones.filter((m) => !covered.has(m));
  const candidates = primes.filter((p) => !chosen.has(p) && p.covers.some((m) => left.includes(m)));

  // the rest: the smallest set of candidates (then the fewest literals) that covers what is left
  const best = smallestCover(left, candidates);

  const terms = [...chosen, ...(best ?? [])];
  return terms
    .map((p) => toCube(p, n))
    .sort((a, b) => order(a, n) - order(b, n));
}

/**
 * Exact smallest cover, by branch and bound on bit sets of the minterms (two
 * 32-bit halves, enough for 6 variables): take the uncovered 1 with the fewest
 * candidates and try each of them, the one that covers most first. A branch is
 * dropped when it cannot beat the best cover found so far; the bound counts
 * uncovered 1s that no single candidate covers together.
 */
function smallestCover(left: number[], candidates: Implicant[]): Implicant[] {
  type Bits = [number, number];
  const bitsOf = (ms: number[]): Bits => {
    const b: Bits = [0, 0];
    for (const m of ms) b[m >> 5] |= 1 << (m & 31);
    return b;
  };
  const count = (b: Bits) => popcount(b[0] >>> 0) + popcount(b[1] >>> 0);
  const and = (x: Bits, y: Bits): Bits => [x[0] & y[0], x[1] & y[1]];
  const has = (b: Bits, m: number) => (b[m >> 5] >>> (m & 31)) & 1;
  const sets = candidates.map((p) => bitsOf(p.covers));
  const lits = candidates.map((p) => popcount(p.mask));
  // for every 1, the candidates that cover it
  const coverers = new Map(left.map((m) => [m, sets.flatMap((s, i) => (has(s, m) ? [i] : []))]));

  let best: number[] | null = null;
  let bestLits = Infinity;
  const chosen: number[] = [];

  const search = (uncovered: Bits, used: number) => {
    if (count(uncovered) === 0) {
      // the bound keeps every complete cover at most as long as the best one
      if (!best || chosen.length < best.length || used < bestLits) {
        best = [...chosen];
        bestLits = used;
      }
      return;
    }
    const open = left.filter((m) => has(uncovered, m));
    // lower bound: 1s whose candidates are all different need a term each
    let bound = 0;
    let blocked: Bits = [0, 0];
    for (const m of open) {
      if (has(blocked, m)) continue;
      bound++;
      for (const i of coverers.get(m)!) blocked = [blocked[0] | sets[i][0], blocked[1] | sets[i][1]];
    }
    const needed = chosen.length + bound;
    if (best !== null) {
      const b: number[] = best;
      if (needed > b.length || (needed === b.length && used >= bestLits)) return;
    }
    let pick = open[0];
    for (const m of open) if (coverers.get(m)!.length < coverers.get(pick)!.length) pick = m;
    const options = coverers
      .get(pick)!
      .map((i) => ({ i, gain: count(and(sets[i], uncovered)) }))
      .sort((x, y) => y.gain - x.gain || lits[x.i] - lits[y.i] || x.i - y.i);
    for (const { i } of options) {
      chosen.push(i);
      search([uncovered[0] & ~sets[i][0], uncovered[1] & ~sets[i][1]], used + lits[i]);
      chosen.pop();
    }
  };
  search(bitsOf(left), 0);
  const found = best as number[] | null; // set inside search()
  return (found ?? []).sort((a, b) => a - b).map((i) => candidates[i]);
}

/** A minimal product of sums, as the cubes of the sum terms: (x + y') is {x: 0, y: 1}, like the zeros it covers. */
export function minimalPos(table: readonly Value[], n: number): Cube[] {
  const flipped = table.map((v): Value => (v === 'd' ? 'd' : v === 1 ? 0 : 1));
  return minimalSop(flipped, n);
}

function toCube(p: Implicant, n: number): Cube {
  const cube: Cube = new Map();
  for (let k = 0; k < n; k++) {
    const bit = n - 1 - k; // variable 0 is the MSB
    if ((p.mask >> bit) & 1) cube.set(k, ((p.bits >> bit) & 1) as 0 | 1);
  }
  return cube;
}

/** Terms in reading order: by their first variable, then by its value. */
const order = (c: Cube, n: number) => {
  let key = 0;
  for (let k = 0; k < n; k++) key = key * 3 + (c.has(k) ? 1 + (c.get(k) === 1 ? 0 : 1) : 0);
  return -key;
};
