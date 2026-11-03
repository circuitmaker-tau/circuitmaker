/** Writing terms and functions the way the course does: X0·X1 + X1'·X2, (A' + B)(B' + C). */
import type { Cube } from './func';

export function literal(name: string, v: 0 | 1) {
  return v === 1 ? name : `${name}'`;
}

const sorted = (c: Cube) => [...c].sort((a, b) => a[0] - b[0]);

/** A product term, e.g. X0·X2. */
export const product = (vars: string[], c: Cube) =>
  c.size === 0
    ? '1'
    : sorted(c)
        .map(([k, v]) => literal(vars[k], v))
        .join('·');

/** A sum term, e.g. A' + C. */
export const sum = (vars: string[], c: Cube) =>
  c.size === 0
    ? '0'
    : sorted(c)
        .map(([k, v]) => literal(vars[k], v))
        .join(' + ');

/** The values of the other variables, e.g. "X0 = 1, X2 = 1". */
export function fixedOthers(vars: string[], m: number, except: number) {
  const n = vars.length;
  return vars
    .map((name, k) => (k === except ? null : `${name} = ${(m >> (n - 1 - k)) & 1}`))
    .filter(Boolean)
    .join(', ');
}

/** Σm(3, 4, 5, 7) */
export const minterms = (ones: number[]) => `Σm(${ones.join(', ')})`;
