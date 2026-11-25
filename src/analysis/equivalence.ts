/**
 * Are two Boolean expressions the same function? (supervisor's review, 25.11:
 * "a Boolean expression written in two ways".) Both are read as in the rest of
 * the app (parseFunction), put on the same variables, and compared row by row.
 * A row where one of them is a don't care (d) does not count as a difference.
 */
import { MAX_FUNCTION_VARS, orderVariables, parseFunction } from './expression';
import type { ParsedFunction } from './expression';
import type { Value } from './minimize';
import { tr } from '../i18n/lang';

export interface ComparedRow {
  /** Row number on the shared variables (MSB first), as in Σm. */
  m: number;
  /** Value of each shared variable in this row. */
  bits: (0 | 1)[];
  a: Value;
  b: Value;
  /** Both are defined here and they differ. */
  differs: boolean;
}

export type Comparison =
  | { ok: false; side: 'a' | 'b' | 'both'; error: string }
  | {
      ok: true;
      vars: string[];
      /** The two functions on the shared variables. */
      a: ParsedFunction;
      b: ParsedFunction;
      rows: ComparedRow[];
      equivalent: boolean;
      /** Rows where both are defined and differ (empty when equivalent). */
      differences: ComparedRow[];
      /** Rows where at least one of them is a don't care. */
      dontCares: number;
    };

/** A list of minterms written without its variables: "Σ(1,3)" or "F = Π(0,2)". */
const undeclaredList = (text: string) =>
  !/^\s*[A-Za-z][A-Za-z0-9_]*\s*\(/.test(text) && /(Σ|Π|\bm|\bM|sum|prod)\s*\(/.test(text);

/** "F = Σ(1,3)" read on the given variables: "F(A,B,C) = Σ(1,3)". */
function onVariables(text: string, vars: string[]): string {
  const eq = text.indexOf('=');
  const name = eq >= 0 ? text.slice(0, eq).trim() || 'F' : 'F';
  const body = eq >= 0 ? text.slice(eq + 1) : text;
  return `${name}(${vars.join(',')}) = ${body.trim()}`;
}

/** The same function on more variables (MSB first); it does not depend on the new ones. */
export function lift(fn: ParsedFunction, vars: string[]): ParsedFunction {
  const n = vars.length;
  const k = fn.vars.length;
  const pos = fn.vars.map((v) => vars.indexOf(v));
  const table = Array.from({ length: 1 << n }, (_, m): Value => {
    let own = 0;
    for (let i = 0; i < k; i++) own = (own << 1) | ((m >> (n - 1 - pos[i])) & 1);
    return fn.table[own];
  });
  return { ...fn, vars, table };
}

export function compareFunctions(textA: string, textB: string): Comparison {
  let pa = parseFunction(textA);
  let pb = parseFunction(textB);
  if (!pa.ok && !pb.ok) return { ok: false, side: 'both', error: pa.error };
  if (!pa.ok) return { ok: false, side: 'a', error: pa.error };
  if (!pb.ok) return { ok: false, side: 'b', error: pb.error };

  // a list such as Σ(1,3) numbers its rows on the other side's variables when it names none
  const listA = undeclaredList(textA);
  const listB = undeclaredList(textB);
  if (listA && !listB && pb.fn.vars.length >= pa.fn.vars.length) {
    pa = parseFunction(onVariables(textA, pb.fn.vars));
    if (!pa.ok) return { ok: false, side: 'a', error: pa.error };
  } else if (listB && !listA && pa.fn.vars.length >= pb.fn.vars.length) {
    pb = parseFunction(onVariables(textB, pa.fn.vars));
    if (!pb.ok) return { ok: false, side: 'b', error: pb.error };
  }

  const vars = orderVariables([...pa.fn.vars, ...pb.fn.vars]);
  if (vars.length > MAX_FUNCTION_VARS) {
    return {
      ok: false,
      side: 'both',
      error: tr(`יחד יש ${vars.length} משתנים (${vars.join(', ')}). אפשר עד ${MAX_FUNCTION_VARS}.`, `Together there are ${vars.length} variables (${vars.join(', ')}). Up to ${MAX_FUNCTION_VARS} are allowed.`),
    };
  }
  const a = lift(pa.fn, vars);
  const b = lift(pb.fn, vars);
  const n = vars.length;
  const rows = a.table.map(
    (va, m): ComparedRow => ({
      m,
      bits: vars.map((_, k) => ((m >> (n - 1 - k)) & 1) as 0 | 1),
      a: va,
      b: b.table[m],
      differs: va !== 'd' && b.table[m] !== 'd' && va !== b.table[m],
    }),
  );
  const differences = rows.filter((r) => r.differs);
  return {
    ok: true,
    vars,
    a,
    b,
    rows,
    equivalent: differences.length === 0,
    differences,
    dontCares: rows.filter((r) => r.a === 'd' || r.b === 'd').length,
  };
}

/** "A = 1, B = 0, C = 1" */
export const assignment = (vars: string[], row: ComparedRow) =>
  vars.map((v, k) => `${v} = ${row.bits[k]}`).join(', ');
