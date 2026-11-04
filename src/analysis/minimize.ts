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
  let best: Implicant[] | null = null;
  const cost = (set: Implicant[]) => set.reduce((s, p) => s + popcount(p.mask), 0);
  for (let size = 0; size <= candidates.length && !best; size++) {
    const pick = (start: number, set: Implicant[]) => {
      if (set.length === size) {
        const all = new Set(set.flatMap((p) => p.covers));
        if (left.every((m) => all.has(m)) && (!best || cost(set) < cost(best))) best = [...set];
        return;
      }
      for (let i = start; i < candidates.length; i++) pick(i + 1, [...set, candidates[i]]);
    };
    pick(0, []);
  }

  const terms = [...chosen, ...(best ?? [])];
  return terms
    .map((p) => toCube(p, n))
    .sort((a, b) => order(a, n) - order(b, n));
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
